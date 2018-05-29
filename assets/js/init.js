var script = document.createElement("script");
var stylesheet = document.getElementById("stylesheet");
function isMobile() {
    var md = new MobileDetect(window.navigator.userAgent);
    if(md.mobile()){
        console.log("this is a mobile device");
        script.setAttribute('src','assets/js/mobile.js');
        document.body.appendChild(script);
        var guide = document.getElementById("text-guide");
        guide.innerHTML = "[double tap]: zoom in, [single tap]: pause, [e]: for ellen";
        stylesheet.setAttribute("href", "assets/css/mobile.css");
    }else{
        console.log("this is not a mobile device");
        script.setAttribute('src','assets/js/script.js');
        document.body.appendChild(script);
    }
}

isMobile();