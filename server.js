const express = require('express');
var fs = require("fs");
const path = require('path');
const fileUpload = require('express-fileupload')
var app = express();
var server = app.listen(3000, () => {
    console.log("Listening on port 3000");
});

const io = require('socket.io')(server, {
    allowEIO3: true // false by default
});

app.use(express.static(path.join(__dirname, "")));

var userConnections = [];


io.on("connection", (socket) => {
    console.log("socket id is ", socket.id);

    socket.on("userconnect", (data) => {
        console.log("userconnect", data.displayName, data.meetingid);

        var other_users = userConnections.filter((p) => p.meeting_id == data.meetingid)
        userConnections.push({
            connectionId: socket.id,
            user_id: data.displayName,
            meeting_id: data.meetingid
        });

        var userCount = userConnections.length;

        other_users.forEach((v) => {
            socket.to(v.connectionId).emit("inform_others_about_me", {
                other_user_id: data.displayName,
                connId: socket.id,
                userNumber: userCount
            })
        })

        socket.emit("inform_me_about_other_user", other_users)
    })

    socket.on("SDPProcess", (data) => {

        //console.log("sdp process started",data);
        socket.to(data.to_connid).emit("SDPProcess", {
            message: data.message,
            from_connid: socket.id
        })
    })

    socket.on("sendMessage", (msg) => {
        console.log(msg);
        var mUser = userConnections.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p) => p.meeting_id == meetingid)
            list.forEach((v) => {
                socket.to(v.connectionId).emit("showChatMessage", {
                    from: from,
                    message: msg
                })
            })
        }
    })


    socket.on("fileTransferToOther", (msg) => {
        console.log(msg);
        var mUser = userConnections.find((p) => p.connectionId == socket.id);
        if (mUser) {
            var meetingid = mUser.meeting_id;
            var from = mUser.user_id;
            var list = userConnections.filter((p) => p.meeting_id == meetingid)
            list.forEach((v) => {
                socket.to(v.connectionId).emit("showhFileMessage", {
                    username: msg.username,
                    meetingid: msg.meetingid,
                    filePath: msg.filePath,
                    fileName: msg.fileName,
                })
            })
        }
    })


    socket.on("disconnect", function () {
        console.log("User got disconnected");
        var disUser = userConnections.find((p) => p.connectionId == socket.id);
        if (disUser) {
            var meetingid = disUser.meeting_id;
            userConnections = userConnections.filter((p) => p.connectionId != socket.id);
            var list = userConnections.filter((p) => p.meeting_id == meetingid);
            list.forEach((v) => {
                var userNumberAfterUserLeave = userConnections.length;
                socket.to(v.connectionId).emit("inform_about_disconnected_user", {
                    connId: socket.id,
                    uNumber: userNumberAfterUserLeave
                })
            })
        }

    })
})

app.use(fileUpload())

app.post("/attachimg", function (req, res) {

    var data = req.body;
    var imgFile = req.files.zipfile;
    console.log(imgFile);
    console.log(data);
    var dir = "public/attachment/" + data.meeting_id + "/";
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }

    console.log("ok ok ");

    imgFile.mv("public/attachment/" + data.meeting_id + "/" + imgFile.name, function (error) {

        if (error) {
            console.log("couldnt upload image file , error: ", error);
        } else {
            console.log("image file successfully uploaded");
        }

    })
})