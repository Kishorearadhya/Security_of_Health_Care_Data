const mongoose=require("mongoose");

const UserOTPSchema=new mongoose.Schema({
    userId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    otp:{type:String,required:true},
    createdAt:{type:Date,expires:6000,default:Date.now}
});

const UserOTP=mongoose.model("UserOTP",UserOTPSchema);
module.exports=UserOTP;