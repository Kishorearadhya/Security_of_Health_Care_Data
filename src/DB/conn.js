const mongoose=require("mongoose");
const multer=require("multer");
const {GridFsStorage}=require("multer-gridfs-storage");
const Grid=require("gridfs-stream");
const crypto=require("crypto");

let gridbucket;
function mongoconnection(){
    mongoose.connect("mongodb://127.0.0.1:27017/FileSharingIntegrityCheck",{
        // useCreateIndex:true,
        // useNewUrlParser:true,
        // useUnifiedTopology:true
    }).then(()=>{
        console.log("Database connection is Successful!!");
        let db=mongoose.connection;
        gridbucket=new mongoose.mongo.GridFSBucket(db,{
            bucketName:"uploads"
        });
    }).catch((e)=>{
        console.log("Database connection Failed!!");
    });
}
mongoconnection();
exports.mongoconnection=mongoconnection;
exports.gridbucket=gridbucket;
