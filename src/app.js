const express = require("express");
const app = express();
const path = require("path");
const ejs = require("ejs");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const Grid = require("gridfs-stream");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const crypto = require("crypto");
const bson = require("bson");
const Admzip = require("adm-zip");
const moment = require("moment");
const { spawn } = require("child_process");
const fs = require("fs");
////
require("./DB/conn");
const conn = mongoose.connection;
let gfs;
conn.once("open", () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

// const storage=new GridFsStorage({
//     url:dotenv.config().parsed.DB_URL,
//     file:(req,file)=>{
//         return new Promise((resolve,reject)=>{
//             crypto.randomBytes(16,(err,buf)=>{
//                 if(err){
//                     return reject(err);
//                 }
//                 const filename=buf.toString("hex") + path.extname(file.originalname);
//                 // console.log(req.session.user);
//                 // console.log(file.originalname);
//                 const userId=new bson.ObjectId(req.session.user);
//                 const fileInfo={
//                     filename:filename,
//                     bucketName:'uploads',
//                     metadata:{
//                         userId:userId,
//                         originalName:file.originalname
//                     }
//                 };
//                 resolve(fileInfo);
//             });
//         });
//     }
// });
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    // console.log(req.session.user);
    // console.log(file.originalname);
    const userId = new bson.ObjectId(req.session.user);
    crypto.randomBytes(16, (err, buf) => {
      if (err) {
        return reject(err);
      }
      const filename = buf.toString("hex") + path.extname(file.originalname);
      cb(null, filename);
    });
  },
});

const upload = multer({ storage });
//////
const PORT = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(methodOverride('_method'));

app.use(
  session({
    secret: "ITS VERY SECRET",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 600000 },
  })
);
app.use((req, res, next) => {
  if (req.session.isAuthenticated && req.session.cookie.expires < new Date()) {
    req.session.destroy(() => {
      return res.redirect("/login?msg=Session+expired!!");
    });
  }
  next();
});
//Email Sender Transporter Start

let transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: dotenv.config().parsed.EMAIL,
    pass: dotenv.config().parsed.PASSWORD,
  },
});

//Email Sender Transporter End
//Models IMPORT Start

const User = require("./models/Users");
const UserOTP = require("./models/UserOTP");
const uploadFile = require("./models/uploadFile");
const Request = require("./models/request");
const Keypair = require("./models/keypair");
const { gridbucket } = require("./DB/conn");
const e = require("express");
//Models IMPORT END
let msg = "";
// console.log(path.join(__dirname,"../public"));
const static_path = path.join(__dirname, "../public");
app.use(express.static(static_path));

app.use(express.json());
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

//Routes Start

app.get("/", async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect("/login");
  } else {
    const user = await User.findById(req.session.user);
    msg = req.query.msg || "";
    return res.render("home.ejs", { user });
  }
});

app.get("/adminDashboard", async (req, res) => {
  if (req.session.isAuthenticated && req.session.isAdmin) {
    const doctors = await User.find({ isDoctor: true });
    const patients = await User.find({ isDoctor: false });
    msg = req.query.msg || "";
    return res.render("adminDashboard.ejs", { doctors,msg,patients});
  } else {
    return res.redirect("/login");
  }
});

app.get("/adddoctor", async (req, res) => {
  if (req.session.isAuthenticated && req.session.isAdmin) {
    return res.render("adddoctor.ejs");
  } else {
    return res.redirect("/login");
  }
});

app.get("/home", async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect("/login");
  } else {
    const user = await User.findById(req.session.user);
    msg = req.query.msg || "";
    // console.log(user);
    return res.render("home", { msg, user });
  }
});

app.get("/login", (req, res) => {
  if (req.session.isAuthenticated) {
    req.session.destroy(() => {
      return res.redirect("/login?msg=Logged+out+successfully!!");
    });
  } else {
    const msg = req.query.msg || "";
    res.render("login.ejs", { msg });
  }
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/verify", async (req, res) => {
  try {
    const id = req.query.id;
    const user = await User.findById(id);
    if (user) {
      user.verified = true;
      await user.save();
      return res.redirect("/login?msg=Email+verified+successfully!!");
    } else {
      return res.redirect("/login?msg=Email+not+verified!!");
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/changepassword", async (req, res) => {
  try {
    if (req.session.isAuthenticated) {
      req.session.destroy(() => {
        return res.redirect("/login?msg=Logged+out+successfully!!");
      });
    } else {
      const msg = req.query.msg || "";
      return res.render("changepassword", { msg });
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/verifyOTP", async (req, res) => {
  try {
    if (req.session.isAuthenticated) {
      const msg = "You are already logged in!!";
      const user = await User.findById(req.session.user);
      return res.render("home", { msg, user });
    }
    if (!req.session.user) {
      const msg = "Please login to continue!!";
      return res.render("login", { msg });
    }
    const msg = req.query.msg || "";
    res.render("verifyOTP", { msg });
  } catch (error) {
    console.log(error);
  }
});

app.get("/upload", async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect("/login");
  } else {
    if (req.session.isDoctor) {
      return res.redirect("/patient");
    }
    const user = await User.findById(req.session.user);
    const files = await uploadFile.find({ userId: req.session.user });
    const msg = req.query.msg || "";
    return res.render("upload.ejs", { msg, user, files });
  }
});

app.get("/dashboard", async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect("/login");
  } else {
    const user = await User.findById(req.session.user);
    msg = req.query.msg || "";
    if (user.isDoctor) {
      const requests = await Request.find({ doctorId: req.session.user });
      const patientIds = requests.map((request) => request.patientId);
      const patients = await User.find({
        _id: { $in: patientIds },
        isDoctor: false,
      });
      return res.render("dashboard", { msg, user, patients, requests });
    } else {
      const user = await User.findById(req.session.user);
      const requests = await Request.find({ patientId: req.session.user });
      const doctorIds = requests.map((request) => request.doctorId);
      const doctors = await User.find({
        _id: { $in: doctorIds },
        isDoctor: true,
      });
      // console.log(doctors);
      msg = req.query.msg || "";
      return res.render("dashboard.ejs", { msg, user,doctors,requests });
    }
  }
});

app.get("/profile", async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect("/login");
  } else {
    const user = await User.findById(req.session.user);
    msg = req.query.msg || "";
    return res.render("profile.ejs", { msg, user });
  }
});

app.get("/patient", async (req, res) => {
  if (!req.session.isAuthenticated || !req.session.isDoctor) {
    return res.redirect("/home?msg=Access Denied!!");
  } else {
    // console.log(req.session.isDoctor);
    const user = await User.findById(req.session.user);
    msg = req.query.msg || "";

    const requests = await Request.find({ doctorId: user._id });
    const patientIds = requests.map((request) => request.patientId);
    const patients = await User.find({
      _id: { $nin: patientIds },
      isDoctor: false,
    });
    // console.log(patients);
    // console.log(requests);
    // const requests = await Request.find({ doctorId: req.session.user });
    return res.render("patient", { msg, user, patients });
  }
});

app.get("/generatekey", async (req, res) => {
  if (!req.session.isAuthenticated || !req.session.isDoctor) {
    return res.redirect("/home?msg=Access Denied!!");
  } else {
    const user = await User.findById(req.session.user);
    msg = req.query.msg || "";
    return res.render("generatekey", { msg, user });
  }
});

app.get("/patientprofile/:id", async (req, res) => {
  if (!req.session.isAuthenticated || !req.session.isDoctor) {
    return res.redirect("/home?msg=Access Denied!!");
  } else {
    const user = await User.findById(req.session.user);
    msg = req.query.msg || "";
    var id = req.params.id;
    const patientprofile = await User.findById(id);
    // console.log(patientprofile);
    return res.render("patientprofile", { msg, user, patientprofile });
  }
});

app.get("/remove/:id", async (req, res) => {
  try {
    if (!req.session.isAuthenticated || !req.session.isAdmin) {
      return res.redirect("/home?msg=Access Denied!!");
    }
    const id = req.params.id;
    const user=await User.findById(id);
    const uploadsFolderPath = path.join(__dirname, "../uploads");
    if(user.isDoctor){
      const files = await uploadFile.find({ userId: id });
      const requests = await Request.find({ doctorId: id });
      files.forEach(async (file) => {
        const filePath = path.join(uploadsFolderPath, file.fileName);
        fs.unlink(filePath, async (unlinkError) => {
          if (unlinkError) {
            console.error(`Error deleting file ${filePath}: ${unlinkError.message}`);
          }
        });
      });
      await User.deleteOne({_id:id});
      await Request.deleteMany({doctorId:id});
      await Keypair.deleteOne({userId:id});
      await uploadFile.deleteMany({userId:id});
      return res.render("adminDashboard",{msg:"Doctor deleted successfully!!",doctors:await User.find({isDoctor:true}),patients:await User.find({isDoctor:false})});
    }else{
      const files = await uploadFile.find({ userId: id });
      files.forEach(async (file) => {
        const filePath = path.join(uploadsFolderPath, file.fileName);
        fs.unlink(filePath, async (unlinkError) => {
          if (unlinkError) {
            console.error(`Error deleting file ${filePath}: ${unlinkError.message}`);
          }
        });
      });
      const requests = await Request.find({ patientId: id });
      await User.deleteOne({_id:id});
      await Request.deleteMany({patientId:id});
      await uploadFile.deleteMany({userId:id});
      return res.render("adminDashboard",{msg:"Patient deleted successfully!!",doctors:await User.find({isDoctor:true}),patients:await User.find({isDoctor:false})});
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/doctorprofile/:id", async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect("/home?msg=Access Denied!!");
  } else {
    const id = req.params.id;
    const user = await User.findById(req.session.user);
    if (user.isDoctor) {
      const patient = await User.findById({ _id: id });
      msg = req.query.msg || "";
      const file = await uploadFile.find({ userId: user._id });
      return res.render("doctorprofile", { msg, user, patient, file });
    } else {
      const doctor = await User.findOne({ _id: id });
      msg = req.query.msg || "";
      return res.render("doctorprofile", { msg, user, doctor });
    }
  }
});

app.get("/files/:filename", async (req, res) => {
  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/login?msg=Please+login+to+continue!!");
    } else {
      const filename = req.params.filename;
      const user = await User.findById(req.session.user);
      const file = await uploadFile.findOne({
        fileName: filename,
        userId: user._id,
      });
      if (!file) {
        return res.redirect("/home?msg=File+not+found!!");
      }
      const fileId = file._id;
      const fileOriginalName = file.fileOriginalName;
      const fileOriginal = path.join(__dirname, `../uploads/${filename}`);
      // console.log(fileOriginal);
      res.download(fileOriginal, fileOriginalName);
      return;
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/request/:id", async (req, res) => {
  try {
    if (!req.session.isAuthenticated || !req.session.isDoctor) {
      return res.redirect("/home?msg=Access Denied!!");
    }
    const id = req.params.id;
    const doctorId = req.session.user;
    const checkKeyPair = await Keypair.findOne({ userId: doctorId });
    if (!checkKeyPair) {
      return res.redirect("/generatekey?msg=Please+generate+keypair+first!!");
    }
    const findRequest = await Request.findOne({
      doctorId: doctorId,
      patientId: id,
    });
    if (findRequest) {
      return res.redirect("/patient?msg=Request already sent!!");
    } else {
      const request = new Request({
        doctorId: doctorId,
        patientId: id,
      });
      const requestSaved = await request.save();
      if (requestSaved) {
        return res.redirect("/patient?msg=Request+sent+successfully!!");
      } else {
        return res.redirect("/patient?msg=Request+failed!!");
      }
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/acceptreq", async (req, res) => {
  try {
    if (!req.session.isAuthenticated || req.session.isDoctor) {
      return res.redirect("/home?msg=Access Denied!!");
    }
    const patientId = req.session.user;
    const requests = await Request.find({
      patientId: patientId,
      status: "pending",
    });
    const doctorIds = requests.map((request) => request.doctorId);
    const doctors = await User.find({
      _id: { $in: doctorIds },
      isDoctor: true,
    });
    // console.log(requests);
    // console.log(doctors);
    const user = await User.findById(req.session.user);
    msg = req.query.msg || "";
    return res.render("acceptreq", { msg, user, requests, doctors });
  } catch (error) {
    console.log(error);
  }
});

app.get("/accept", async (req, res) => {
  try {
    if (!req.session.isAuthenticated) {
      return res.redirect("/home?msg=Access Denied!!");
    } else {
      msg = req.query.msg || "";
      const user = await User.findById(req.session.user);
      return res.render("acceptreq", { msg, user });
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/register", async (req, res) => {
  try {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const cpassword = req.body.cpassword;

    if (/^[a-zA-Z ]+$/i.test(name)) {
      if (password === cpassword) {
        const emailCheck = await User.findOne({ email });
        if (emailCheck) {
          error = true;
          msg = "User already exists!!";
          return res.render("register", { msg });
        } else {
          const user = new User({
            name: name,
            email: email,
            password: password,
            verified: false,
          });
          const userRegistered = await user.save();
          if (userRegistered) {
            res.redirect(
              "/login?msg=User+registered+successfully,please+verify+your+email+to+login!!"
            );
            sendVerifyEmail(userRegistered);
          }
        }
      } else {
        error = true;
        msg = "Password not matching!!";
        return res.render("register", { msg, name, email });
      }
    } else {
      msg = "Name should only contain alphabets!!";
      return res.render("register", { msg });
    }
  } catch (error) {
    msg = "Some error occured!!";
    return res.render("register", { msg });
  }
});

app.post("/changepassword", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const npassword = req.body.npassword;
    const cnpassword = req.body.cnpassword;
    if (password === npassword) {
      msg = "Old password and new password cannot be same!!";
      return res.render("changepassword", { msg });
    }
    if (npassword === cnpassword) {
      const user = await User.findOne({ email });
      if (user) {
        if (user.password === password) {
          user.password = npassword;
          user.verified = true;
          await user.save();
          return res.render("login", {
            msg: "Password changed successfully!!",
          });
        } else {
          msg = "Invalid Credentials!!";
          return res.render("changepassword", { msg });
        }
      } else {
        msg = "User doesnt exists!!";
        return res.render("changepassword", { msg });
      }
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/verifyOTP", async (req, res) => {
  try {
    const otp = req.body.otp;
    const userOTP = await UserOTP.findOne({
      userId: req.session.user,
      otp: otp,
    });
    if (userOTP) {
      req.session.isAuthenticated = true;
      await UserOTP.deleteMany({ userId: req.session.user });
      const user = await User.findById(req.session.user);
      req.session.isDoctor = user.isDoctor;
      return res.redirect("/home?msg=Logged+in+successfully!!");
    } else {
      msg = "Invalid OTP!!";
      return res.render("verifyOTP", { msg });
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/login", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const checkEmail = await User.findOne({ email });
    if (checkEmail) {
      if (!checkEmail.isAdmin) {
        if (checkEmail.password === password) {
          if (checkEmail.verified) {
            req.session.isAuthenticated = false;
            req.session.user = checkEmail._id;
            sendOTP(checkEmail, res);
            return res.redirect("/verifyOTP?msg=OTP+sent+to+your+email!!");
          } else {
            const msg = "Please verify your email to login!!";
            return res.render("login", { msg });
          }
        } else {
          msg = "Invalid Credentials!!";
          return res.render("login", { msg });
        }
      } else {
        if (checkEmail.password === password) {
          req.session.isAuthenticated = true;
          req.session.user = checkEmail._id;
          req.session.isAdmin = true;
          return res.redirect(
            "/adminDashboard?msg=Admin+Logged+in+successfully!!"
          );
        } else {
          msg = "Invalid Credentials!!";
          return res.render("login", { msg });
        }
      }
    } else {
      msg = "User doesnt exists!!";
      return res.render("login", { msg });
    }
  } catch (error) {
    msg = "Some error occured!!";
    return res.render("login", { msg });
  }
});

app.post("/profile", async (req, res) => {
  try {
    const name = req.body.name;
    const mobileNumber = req.body.mobileNumber;
    const address1 = req.body.address1;
    const city = req.body.city;
    const state = req.body.state;
    const country = req.body.country;
    const description = req.body.description;
    const updatedUser = await User.findByIdAndUpdate(req.session.user, {
      name,
      mobileNumber,
      address: {
        address1,
        city,
        state,
        country,
      },
      description,
    });
    if (updatedUser) {
      req.session.user = updatedUser._id;
      return res.redirect("/profile?msg=Profile+updated+successfully!!");
    } else {
      return res.redirect("/profile?msg=Profile+update+Failed!!");
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/adddoctor", async (req, res) => {
  try {
    const name = req.body.name;
    const mobileNumber = req.body.mobileNumber;
    const email = req.body.email;
    const password = "Pa$$word";
    const emailCheck = await User.findOne({ email });
    if (emailCheck) {
      error = true;
      msg = "Doctor already exists!!";
      return res.render("adddoctor", { msg });
    } else {
      const user = new User({
        name: name,
        email: email,
        password: password,
        mobileNumber: mobileNumber,
        verified: false,
        isDoctor: true,
      });
      const userRegistered = await user.save();
      if (userRegistered) {
        res.render("adddoctor", { msg: "Doctor added successfully!!" });
        sendDoctorEmail(userRegistered);
      }
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const fileOriginalName = req.file.originalname;
    const userId = new bson.ObjectId(req.session.user);
    const filename = req.file.filename;
    const uploadfile = new uploadFile({
      fileName: filename,
      fileOriginalName: fileOriginalName,
      userId: userId,
    });
    await uploadfile.save();
    return res.redirect("/upload?msg=File+uploaded+successfully!!");
  } catch (error) {
    return res.redirect("/upload?msg=File+upload+failed!!");
  }
});

app.post("/generatekey", async (req, res) => {
  try {
    const userId = req.session.user;
    const passphrase = req.body.passphrase;
    const { publicKey, privateKey } = generatekeypair(passphrase);
    const checkKey = await Keypair.findOne({ userId: userId });
    if (checkKey) {
      const updatedKey = await Keypair.findByIdAndUpdate(checkKey._id, {
        publicKey: publicKey,
        privateKey: privateKey,
      });
      if (updatedKey) {
        return res.redirect("/generatekey?msg=Keypair+updated+successfully!!");
      }
      return res.redirect("/generatekey?msg=Keypair+update+Failed!!");
    } else {
      const keypair = new Keypair({
        publicKey: publicKey,
        privateKey: privateKey,
        userId: userId,
      });
      const keypairSaved = await keypair.save();
      if (keypairSaved) {
        return res.redirect(
          "/generatekey?msg=Keypair+generated+successfully!!"
        );
      }
      return res.redirect("/generatekey?msg=Keypair+generation+failed!!");
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/accept", async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    if (!user.isDoctor) {
      const doctorId = req.body.email;
      const patientId = req.session.user;
      const password = req.body.password;
      const patient = await User.findById(patientId);
      const doctor = await User.findOne({ email: doctorId });
      const files = await uploadFile.find({ userId: patientId });
      const keyPair = await Keypair.findOne({ userId: doctor._id });

      const zip = new Admzip();

      files.forEach((file) => {
        const fileOriginal = path.join(
          __dirname,
          `../uploads/${file.fileName}`
        );
        const fileOriginalName = file.fileOriginalName || file.fileName;
        zip.addLocalFile(fileOriginal, null, fileOriginalName);
      });
      const currentDate = moment().format("YYYY-MM-DD_HH-mm-ss");
      const zipFileName = `${patient.name}_${currentDate}.zip`;
      const zipFilePath = path.join(__dirname, `../uploads/${zipFileName}`);
      zip.writeZip(zipFilePath);

      const inputZip = path.join(__dirname, `../uploads/${zipFileName}`);
      const pZipName = `${patient.name}_${currentDate}P.zip`;
      const filename = await generateRandomFilename(pZipName);
      const outputZip = path.join(__dirname, `../uploads/${filename}`);

      const pythonProcess = spawn("python", [
        "./public/password.py",
        inputZip,
        outputZip,
        password,
      ]);

      pythonProcess.stdout.on("data", (data) => {
        console.log(`Python stdout: ${data}`);
      });

      pythonProcess.stderr.on("data", (data) => {
        console.error(`Python stderr: ${data}`);
      });

      pythonProcess.on("close", (code) => {
        if (code === 0) {
          console.log("Password-protected zip file created successfully.");
          // Now you can update MongoDB or perform any other necessary actions
        } else {
          console.error(`Python process exited with code ${code}`);
          res.status(500).send("Internal Server Error");
        }
      });

      const uploadzip = new uploadFile({
        fileName: filename,
        fileOriginalName: pZipName,
        userId: doctor._id,
      });
      await uploadzip.save();

      const fileId = uploadzip._id;
      console.log(password);
      const encryptedPassword = encryptWithPublicKey(
        password,
        keyPair.publicKey
      );
      const requestUpdate = await Request.findOneAndUpdate(
        { doctorId: doctor._id, patientId: patientId },
        { status: "accepted", fileId: fileId, password: encryptedPassword }
      );
      return res.redirect("/acceptreq?msg=Request+accepted+successfully!!");
    }else{
      const passphrase = req.body.passphrase;
      const patient=await User.findOne({email:req.body.email});
      const patientId=patient._id;
      const keyPair = await Keypair.findOne({ userId: user._id });
      const request=await Request.findOne({doctorId:user._id,patientId:patientId});
      const requests = await Request.find({ doctorId: req.session.user });
      const patientIds = requests.map((request) => request.patientId);
      const file = await uploadFile.find({ userId: user._id });
      const patients = await User.find({
        _id: { $in: patientIds },
        isDoctor: false,
      });
      try {
        const decryptedPassword = decryptWithPrivateKeyAndPassphrase(request.password, keyPair.privateKey , passphrase);
        return res.render('dashboard', { msg: `Password is: ${decryptedPassword} ,This password is used to decrypt the File!!`,user,patients,requests });
      } catch (error) {
        return res.render('dashboard', { msg: `Wrong Passphrase!!`,user,patients,requests });
      }
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/logout", (req, res) => {
  if (req.session.user) {
    req.session.destroy(() => {
      return res.redirect("/login?msg=Logged+out+successfully!!");
    });
  } else {
    res.redirect("/login");
  }
});

//Routes End

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}\nhttp://localhost:${PORT}/`);
});

const sendOTP = async ({ _id, email }, res) => {
  try {
    const otp = `${Math.floor(1000 + Math.random() * 9000)}`;
    const mailOptions = {
      from: dotenv.config().parsed.EMAIL,
      to: email,
      subject: "Verify your email!",
      html: `<h4>OTP: ${otp}</h4>`,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log(`Email sent: ${otp} ${info.response}`);
        const userOTP = new UserOTP({
          userId: _id,
          otp,
        });
        userOTP.save();
      }
    });
  } catch (error) {
    console.log(error);
  }
};

const sendVerifyEmail = async (user) => {
  try {
    const mailOptions = {
      from: dotenv.config().parsed.EMAIL,
      to: user.email,
      subject: "Verify your email!",
      html: `<h4>Click <a href="http://localhost:3000/verify?id=${user._id}">here</a> to verify your email</h4>`,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log(`Email sent: ${info.response}`);
      }
    });
  } catch (error) {
    console.log(error);
  }
};

const sendDoctorEmail = async (user) => {
  try {
    const mailOptions = {
      from: dotenv.config().parsed.EMAIL,
      to: user.email,
      subject: "Verify your email!",
      html: `<p>Hello ${user.name},<br><br>Change your password to activate and get verified!!<br>Link: http://localhost:3000/changepassword<br>Email: ${user.email}<br>Password: Pa$$word<br></p>`,
    };
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log(`Email sent: ${info.response}`);
      }
    });
  } catch (error) {
    console.log(error);
  }
};

const generateRandomFilename = (previousFilename) => {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (err, buf) => {
      if (err) {
        reject(err);
      } else {
        const newFilename =
          buf.toString("hex") + path.extname(previousFilename);
        resolve(newFilename);
      }
    });
  });
};

function generatekeypair(passphrase) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: passphrase,
    },
  });
  return { publicKey, privateKey };
}

function encryptWithPublicKey(data, publicKey) {
  const bufferData = Buffer.from(data, 'utf-8');
  const key = crypto.createPublicKey({ key: publicKey, format: 'pem', type: 'spki' });
  const encryptedBuffer = crypto.publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, bufferData);
  return encryptedBuffer.toString('base64');
}

function decryptWithPrivateKeyAndPassphrase(encryptedData, privateKey, passphrase) {
  const bufferEncryptedData = Buffer.from(encryptedData, 'base64');
  const key = crypto.createPrivateKey({ key: privateKey, format: 'pem', type: 'pkcs8', passphrase: passphrase });
  const decryptedBuffer = crypto.privateDecrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, bufferEncryptedData);
  return decryptedBuffer.toString('utf-8');
}