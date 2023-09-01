require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const cron = require('node-cron');
const nodemailer = require("nodemailer");
var request =require('request'); 
const querystring = require('querystring');

//Express Settings
const app= express();
app.use(express.json());
app.use(bodyParser.urlencoded({extended:true}));

mongoose.set('strictQuery',true);
mongoose.connect(process.env.MONGODB_URI,{ useNewUrlParser:true });






//Configure nodemailer
let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
            user: process.env.GMAIL,
            pass: process.env.APP_KEY
      }
});



//Database Schemas and Models building
const UserSchema = new mongoose.Schema({

      email:String,
      password:String,
      location:{
            lon:String,
            lat:String
      },
      weather:[
            {
                  date:{ type: Date, default: Date.now },
                  weather_in:{}
            }
            
      ]
});

const User = new mongoose.model("User",UserSchema);




//sheduler

async function update(){
      let users = await User.find();
      for (let i in await users){
            const parameters = {
                  appid: process.env.WEATHER_MAP_AUTH_KEY,
                  lat: users[i].location.lat,
                  lon:users[i].location.lon
            }
            const get_args = querystring.stringify(parameters);

            url= 'https://api.openweathermap.org/data/2.5/weather?' +get_args,
         
            request.get(url,parameters,async (err,res,body)=>{
                  
                  if(err){
                        console.log(err);
                  }
                  if(res.statusCode === 200 ){
                        weather= {
                                    date: new Date(),
                                    weather_in: JSON.parse(await body)
                              }
                        await User.updateOne({_id:users[i]._id},{ $push: {weather:weather}});

                        const mailOptions = {
                              from: process.env.GMAIL,
                              to: users[i].email,
                              subject: 'Weather App',
                              text: 'Hear is the weather report:' + JSON.stringify(await body)
                        };
                        transporter.sendMail(mailOptions, function(error, info){
                              if (error) {
                                    console.log(error);
                              } else {
                                    console.log('Email sent: ' + info.response);
                              }
                        });
                  }     
            });
      }
}

cron.schedule('1 1 */3 * * *', () => {
      update();
});

//Routes 

app.post('/register', async (req, res) => {
      let email =req.body.email;
      let password = req.body.password;
      let lon =req.body.lon;
      let lat = req.body.lat;

      if(email && password && lon && lat){
            location={
                  lon:lon,
                  lat:lat
            }
            let user =  await User.findOne({email:email});
            if(user){
                  const mailOptions = {
                        from: process.env.GMAIL,
                        to: email,
                        subject: 'Weather App',
                        text: 'Someone is trying to create an account using your email address. secure your account'
                  };
                  transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                              console.log(error);
                        } else {
                              console.log('Email sent: ' + info.response);
                        }
                  });

                  res.send({
                        message:"Email is already in use",
                  });
            }else{
                  newuser= new User({
                        email:email,
                        password:password,
                        location:location
                  });
                  await newuser.save();
                  let user =  await User.findOne({email:email});

                  const mailOptions = {
                        from: process.env.GMAIL,
                        to: email,
                        subject: 'Weather App',
                        text: 'You have successfully registered for the weather app. your auth key is :' + user._id
                  };
                  transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                              console.log(error);
                        } else {
                              console.log('Email sent: ' + info.response);
                        }
                  });

                  res.send({
                        message:"Successfully registered! the API Key will be sent to your Email.",
                  });
            }
      }else{
            res.send({
                  message:"Please fillout the all Fields",
            });
      }  
});


app.put('/location', async (req, res) => {
      let uid=req.body.key;
      let lon=req.body.lon;
      let lat=req.body.lat;

      if(uid){
            let user =  await User.findOne({_id:uid});
            if(user){
                  location ={
                        lon:lon,
                        lat:lat
                  }
                  await User.updateOne({_id:uid},{location:location});
                  res.send({
                        message:'Successfully updated the location'
                  }); 
            }else{
                  res.send({
                        message:'Auth key is Not valid'
                  });  
            }
      }else{
            res.send({
                  message:'Auth key is empty. Please fill it out'
            });
      }

})

app.get('/weatherofdate', async (req, res) => {
      let uid=req.query.id;
      let date=req.query.date;
      let today =new Date(date);
      let oldday = new Date(today);
      let temp = today.setDate(today.getDate()+1);
      let nextday = new Date(temp);
      console.log(oldday +uid);
      console.log(nextday);

      if(uid){
            let user =  await User.findOne({_id:uid});
            if(user){
                  // let reports =await User.aggregate([{$match:{_id:uid}},{$unwind:"$weather"},{$match:{'weather.date':{$gte:oldday,$lt:nextday}}}]);
                  let reports =await User.aggregate().match({_id:new mongoose.Types.ObjectId(uid)}).unwind("weather").match({'weather.date':{$gte:oldday,$lt:nextday}});
                  res.send(reports);
                  

            }else{
                  res.send({
                        message:'Auth key is Not valid'
                  }); 
            }

      }else{
            res.send({
                  message:'Auth key is empty. Please fill it out'
            });
      }
})




app.listen(process. env. PORT || 3000,()=>{
      console.log("Server is listening at port 3000...")
});







