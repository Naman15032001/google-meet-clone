var AppProcess = (function () {

    var peers_connection_ids = [];
    var peers_connection = [];
    var remote_vid_stream = [];
    var remote_aud_stream = [];

    var serverProcess;
    var my_connection_id;
    var local_div;
    var audio;
    var isAudioMute = true;
    var rtp_aud_senders = [];
    var rtp_vid_senders = []

    var video_states = {
        None: 0,
        Camera: 1,
        ScreenShare: 2
    }

    var video_st = video_states.None;

    var videoCamTrack;

    async function _init(SDP_function, my_connid) {
        serverProcess = SDP_function;
        my_connection_id = my_connid;
        eventProcess();
        local_div = document.getElementById('localVideoPlayer');
    }

    async function eventProcess() {
        $('#miceMuteUnmute').on("click", async function () {
            if (!audio) {
                await loadAudio();
            }

            if (!audio) {
                alert("Audio permission not granted");
                return;
            }

            if (isAudioMute) {
                audio.enabled = true;
                $(this).html('<span class="material-icons" style="width: 100%;">mic</span>');
                console.log("here 2");
                updateMediaSenders(audio, rtp_aud_senders);
            } else {
                audio.enabled = false;
                $(this).html('<span class="material-icons" style="width: 100%;">mic_off</span>');
                removeMediaSenders(rtp_aud_senders);
            }

            isAudioMute = !isAudioMute;
        })

        $("#videoCamOnOff").on("click", async function () {

            if (video_st == video_states.Camera) {
                await videoProcess(video_states.None)
            } else {
                await videoProcess(video_states.Camera)
            }
        })

        $("#btnScreenShareOnOff").on("click", async function () {

            if (video_st == video_states.ScreenShare) {
                await videoProcess(video_states.None)
            } else {
                await videoProcess(video_states.ScreenShare)
            }
        })
    }

    async function loadAudio() {
        try {
            var astream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
            audio = astream.getAudioTracks()[0];
            audio.enabled = false;

        } catch (e) {
            console.log(e);
        }
    }

    function connection_status(connection) {
        if (connection && (connection.connectionState == "new" || connection.connectionState == "connecting" || connection.connectionState == "connected")) {
            return true;
        } else {
            return false;
        }

    }

    async function updateMediaSenders(track, rtp_senders) {

        console.log(peers_connection_ids, peers_connection_ids.length, "naman");
        console.log(peers_connection, peers_connection.length, "naman");

        for (var con_id in peers_connection_ids) {

            if (connection_status(peers_connection[con_id])) {

                if (rtp_senders[con_id] && rtp_senders[con_id].track) {
                    rtp_senders[con_id].replaceTrack(track)
                } else {
                    rtp_senders[con_id] = peers_connection[con_id].addTrack(track)
                }

            }

        }

    }

    function removeMediaSenders(rtp_senders) {
        for (var con_id in peers_connection_ids) {
            if (rtp_senders[con_id] && connection_status(peers_connection[con_id])) {
                peers_connection[con_id].removeTrack(rtp_senders[con_id]);
                rtp_senders[con_id] = null;
            }
        }
    }

    function removeVideoStream(rtp_vid_senders) {

        if (videoCamTrack) {

            videoCamTrack.stop();
            videoCamTrack = null;
            local_div.srcObject = null;

            removeMediaSenders(rtp_vid_senders)
        }
    }


    async function videoProcess(newVideoState) {

        if (newVideoState == video_states.None) {
            $('#videoCamOnOff').html('<span class="material-icons" style="width: 100%;">videocam_off</span>')


            $('#btnScreenShareOnOff').html('<span class="material-icons">present_to_all</span><div>Present Now</div>');

            video_st = newVideoState;
            removeVideoStream(rtp_vid_senders);
            return;

        }





        if (newVideoState == video_states.Camera) {
            $('#videoCamOnOff').html('<span class="material-icons" style="width: 100%;">videocam_on</span>')
        }

        try {
            var vstream = null;
            if (newVideoState == video_states.Camera) {
                vstream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        height: 1920,
                        width: 1080
                    },
                    audio: false
                })
            } else if (newVideoState == video_states.ScreenShare) {
                vstream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        height: 1920,
                        width: 1080
                    },
                    audio: false
                })

                vstream.oninactive = (e) => {
                    removeVideoStream(rtp_vid_senders);
                    $('#btnScreenShareOnOff').html('<span class="material-icons">present_to_all</span><div>Present Now</div>');
                }
            }

            if (vstream && vstream.getVideoTracks().length > 0) {
                videoCamTrack = vstream.getVideoTracks()[0];
                if (videoCamTrack) {
                    local_div.srcObject = new MediaStream([videoCamTrack]);
                    console.log("here 3");
                    updateMediaSenders(videoCamTrack, rtp_vid_senders)
                }
            }

        } catch (e) {
            console.log(e);
            return;
        }

        video_st = newVideoState;

        if (newVideoState == video_states.Camera) {
            $('#videoCamOnOff').html('<span class="material-icons" style="width: 100%;">videocam_on</span>');
            $('#btnScreenShareOnOff').html('<span class="material-icons">present_to_all</span><div>Present Now</div>');

        } else if (newVideoState == video_states.ScreenShare) {
            $('#btnScreenShareOnOff').html('<span class="material-icons text-success">present_to_all</span><div class="text-success">Stop Present Now</div>');
            $('#videoCamOnOff').html('<span class="material-icons" style="width: 100%;">videocam_off</span>')
        }


    }

    var iceConfiguration = {
        iceServers: [{
                urls: "stun:stun.l.google.com:19302"
            },
            {
                urls: "stun:stun1.l.google.com:19302"
            }
        ]
    }

    async function setConnection(connid) {
        var connection = new RTCPeerConnection(iceConfiguration);

        console.log("set connection started");

        connection.onnegotiationneeded = async function (event) {
            await setOffer(connid)
        }

        connection.onicecandidate = function (event) {
            if (event.candidate) {
                serverProcess(JSON.stringify({
                        iceCandidate: event.candidate
                    }),
                    connid
                )
            }
        }

        connection.ontrack = function (event) {

            if (!remote_vid_stream[connid]) {
                remote_vid_stream[connid] = new MediaStream();
            }

            if (!remote_aud_stream[connid]) {
                remote_aud_stream[connid] = new MediaStream();
            }

            if (event.track.kind == "video") {
                remote_vid_stream[connid].getVideoTracks().forEach((t) =>
                    remote_vid_stream[connid].removeTrack(t)
                );
                remote_vid_stream[connid].addTrack(event.track);
                var remoteVideoPlayer = document.getElementById("v_" + connid);
                remoteVideoPlayer.srcObject = null;
                remoteVideoPlayer.srcObject = remote_vid_stream[connid];
                remoteVideoPlayer.load()
            } else if (event.track.kind == "audio") {

                remote_aud_stream[connid].getAudioTracks().forEach((t) =>
                    remote_aud_stream[connid].removeTrack(t)
                );
                remote_aud_stream[connid].addTrack(event.track);
                var remoteAudioPlayer = document.getElementById("a_" + connid);
                remoteAudioPlayer.srcObject = null;
                remoteAudioPlayer.srcObject = remote_aud_stream[connid];
                remoteAudioPlayer.load()

            }



        }

        peers_connection_ids[connid] = connid;
        peers_connection[connid] = connection;

        console.log(connid, connection, "before array set");

        console.log("array set", peers_connection_ids, peers_connection);

        if (video_st == video_states.Camera || video_st == video_states.ScreenShare) {

            if (videoCamTrack) {
                console.log("here 1");
                updateMediaSenders(videoCamTrack, rtp_vid_senders)
            }
        }
        return connection;
    }

    async function setOffer(connid) {
        console.log("set offer started");
        var connection = peers_connection[connid];
        var offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        serverProcess(JSON.stringify({
            offer: connection.localDescription
        }), connid)
        console.log("set offer complated");
    }

    async function SDPProcess(message, from_connid) {
        message = JSON.parse(message);


        console.log("recieved message ", message);

        if (message.answer) {

            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.answer))
            console.log("recieved answer and remote description set");

        } else if (message.offer) {

            console.log("recieved offer")
            if (!peers_connection[from_connid]) {

                console.log("inside set peer sconect")
                await setConnection(from_connid)
            }

            await peers_connection[from_connid].setRemoteDescription(new RTCSessionDescription(message.offer))

            console.log("Remote description set")

            var answer = await peers_connection[from_connid].createAnswer();
            await peers_connection[from_connid].setLocalDescription(answer);

            serverProcess(JSON.stringify({
                answer: answer
            }), from_connid)

        } else if (message.iceCandidate) {

            console.log("hereee ice canidate")

            if (!peers_connection[from_connid]) {
                await setConnection(from_connid);
            }

            try {
                await peers_connection[from_connid].addIceCandidate(message.iceCandidate)
            } catch (e) {
                console.log(e);
            }
        }
    }

    async function closeConnection(connid) {
        peers_connection[connid] = null;
        if (peers_connection[connid]) {
            peers_connection[connid].close();
            peers_connection[connid] = null;
        }

        if (remote_aud_stream[connid]) {
            remote_aud_stream[connid].getTracks().forEach((t) => {
                if (t.stop) t.stop()
            })
            remote_aud_stream[connid] = null
        }

        if (remote_vid_stream[connid]) {
            remote_vid_stream[connid].getTracks().forEach((t) => {
                if (t.stop) t.stop()
            })
            remote_vid_stream[connid] = null
        }
    }

    return {
        setNewConnection: async function (connid) {
            await setConnection(connid)
        },
        init: async function (SDP_function, my_connid) {
            await _init(SDP_function, my_connid)
        },
        processClientFunc: async function (data, from_connid) {
            await SDPProcess(data, from_connid)
        },
        closeConnectionCall: async function (connid) {
            await closeConnection(connid)
        }
    }


})()





var MyApp = (function () {

    var socket = null;
    var user_id = "";
    var meeting_id = "";

    function init(uid, mid) {
        user_id = uid;
        meeting_id = mid;
        $('#meetingContainer').show();
        $('#me h2').text(user_id + "(Me)")
        document.title = user_id
        event_process_signaling_server();
        eventHandeling();
    }



    function event_process_signaling_server() {

        socket = io.connect();

        var SDP_function = function (data, to_connid) {
            socket.emit("SDPProcess", {
                message: data,
                to_connid: to_connid
            })
        }

        socket.on("connect", () => {

            if (socket.connected) {
                AppProcess.init(SDP_function, socket.id)
                if (user_id != "" && meeting_id != "") {
                    socket.emit("userconnect", {
                        displayName: user_id,
                        meetingid: meeting_id
                    })
                }
            }
        });

        socket.on("inform_about_disconnected_user", function (data) {
            $('#' + data.connId).remove();
            AppProcess.closeConnectionCall(data.connId)
        })

        socket.on("inform_others_about_me", function (data) {
            addUser(data.other_user_id, data.connId);
            console.log("new connection started", data);
            AppProcess.setNewConnection(data.connId);
        })

        //inform_me_about_other_user

        socket.on("inform_me_about_other_user", function (other_users) {

            if (other_users) {
                for (var i = 0; i < other_users.length; i++) {
                    addUser(other_users[i].user_id, other_users[i].connectionId);
                    AppProcess.setNewConnection(other_users[i].connectionId);
                }
            }
        })

        socket.on("SDPProcess", async function (data) {
            await AppProcess.processClientFunc(data.message, data.from_connid)
        })
    }


    function eventHandeling() {

        $('#btnsend').on("click", function () {
            socket.emit("sendMessage", $("#msgbox").val());
            $("#msgbox").val("")
        })
    }

    socket.on("showChatMessage", function (data) {
        var time = new Date();
        var lTime = time.toLocaleString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true
        })

        var div = $("<div>").html("<span class='font-weight-bold mr-3' style='color:black'>" + data.from + "</span>" + lTime + "</br>" + data.message)
        $("#messages").append(div)
    })

    function addUser(other_user_id, connId) {

        var newDivId = $('#otherTemplate').clone();

        newDivId = newDivId.attr("id", connId).addClass("other");

        newDivId.find("h2").text(other_user_id);

        newDivId.find("video").attr("id", "v_" + connId);

        newDivId.find("audio").attr("id", "a_" + connId);

        newDivId.show();

        $('#divUsers').append(newDivId)
    }

    return {
        _init: function (uid, mid) {
            init(uid, mid)
        }
    }
})();