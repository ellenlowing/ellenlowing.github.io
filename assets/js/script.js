let camera, scene, renderer;
let GLrenderer;
let controls;
let scale = 1;
let zoomed, paused, nameRendered;
let current;
let mflag;
let cameraLimits = [
    [-0.7, 0.7, -1, -0.5],
    [-1, -0.5, -0.7, 0.7],
    [-0.8, 0.8, 0.5, 1],
    [0.5, 1, -0.8, 0.8]
];
let descriptionIds = ["Experimental", "Design", "Hardware", "Interactive"];
let descriptionInit = [0, 0, 0, 0];
let cameraPos = [600, 0, 500];
let initCameraPos;
let group;
let description;
let device;
let lazyloaded = false;
let lastTap = 0;
let timeout;
let touchStartTime;

function isMobile() {
    let md = new MobileDetect(window.navigator.userAgent);
    if (md.mobile()) {
        document.body.classList.add('mobile');
    } else {
        document.body.classList.add('desktop');
    }
    return md.mobile();
}

let mobileMode = isMobile();

let Element = function(id, x, y, z, rx, ry) {
    let div = document.createElement('div');
    div.style.width = '480px';
    div.style.height = '480px';
    //div.style.backgroundColor = '#fff';
    let img = document.createElement('img');
    img.style.width = '480px';
    img.style.height = '480px';
    img.style.border = '0px';
    img.style.opacity = "0.9";
    img.style.border = "0px";
    img.alt = "";
    let src = "assets/images/faces/";
    img.src = src + descriptionIds[id] + ".gif";

    let p = document.createElement('p');
    p.style.width = '480px';
    p.style.height = '480px';
    //p.style.color = '#fff';
    p.innerHTML = descriptionIds[id];
    p.style.fontFamily = "Roboto, sans-serif";
    p.style.textAlign = "center";
    p.style.top = "25%";
    p.style.position = "absolute";
    p.style.zIndex = "99";
    p.style.fontSize = "50px";
    p.style.fontWeight = "500";
    p.style.fontStyle = "italic";
    p.style.webkitTextStroke = "1.5px black";
    p.style.color = "white";

    div.appendChild(img);
    // div.appendChild(p);

    let object = new THREE.CSS3DObject(div);
    object.position.set(x, y, z);
    object.rotation.x = rx;
    object.rotation.y = ry;
    return object;
};

init();
animate();
window.onload = function() {
    console.log("Finish loading");

    // automate keydown
    // window.dispatchEvent(new KeyboardEvent('keydown', {
    //     'key': 'z'
    // }));
}
function init() {
    let container = document.getElementById('container');
    camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(cameraPos[0], cameraPos[1], cameraPos[2]);
    zoomed = false;
    paused = false;
    mflag = false;
    nameRendered = false;
    scene = new THREE.Scene();
    renderer = new THREE.CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = 0;
    container.appendChild(renderer.domElement);
    group = new THREE.Group();
    group.add(new Element(0, 0, 0, 240, 0, 0));
    group.add(new Element(1, 240, 0, 0, 0, Math.PI / 2));
    group.add(new Element(2, 0, 0, -240, 0, Math.PI));
    group.add(new Element(3, -240, 0, 0, 0, -Math.PI / 2));
    scene.add(group);
    controls = new THREE.OrbitControls(camera);
    controls.autoRotateSpeed = 8;
    controls.autoRotate = true;
    controls.enabled = false;
    description = document.getElementById('description-main');
    // let initZoomScale = 19;
    //     // let initZoomFunction = setInterval( function(){
    //     //     camera.position.set(cameraPos[0]*initZoomScale, cameraPos[1]*initZoomScale, cameraPos[2]*initZoomScale);
    //     //     initZoomScale -= 1;
    //     //     if(initZoomScale < 1){
    //     //         clearInterval(initZoomFunction);
    //     //         controls.autoRotate = true;
    //     //     }
    //     // }, 50);
    //     // setTimeout(initZoomFunction, 1000);

    //     window.mobilecheck = function() {
    //       let check = false;
    //       (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    //       return check;
    //     };


    window.addEventListener('resize', onWindowResize, false);
    if(mobileMode) {
        window.addEventListener('touchend', detectTaps, false);
    } else {
        window.addEventListener('keydown', zoom, false);
        window.addEventListener('keydown', pause, false);
    }
    

    GLrenderer = new THREE.WebGLRenderer({ alpha: 1, antialias: true, clearColor: 0xffffff });
    GLrenderer.setSize(window.innerWidth, window.innerHeight);
    GLrenderer.domElement.style.position = 'absolute';
    GLrenderer.domElement.style.top = 0;
    container.appendChild(GLrenderer.domElement);

}

function detectTaps(event) {
    console.log('tap')
    let currentTime = new Date().getTime();
    let tapLength = currentTime - lastTap;
    clearTimeout(timeout);
    if (tapLength < 300 && tapLength > 0) {
        event.preventDefault();
        zoom(event);
    } else {
        if (!zoomed) {
            pause(event);
        }
        timeout = setTimeout(function() {
            clearTimeout(timeout);
        }, 300);
    }
    lastTap = currentTime;
}

function zoom(event) {
    event.preventDefault();
    if ((event.key == "z" && !mobileMode) || mobileMode) {
        if (zoomed) {
            description.style.display = "none";
            let zoomOutFunction = setInterval(function() {
                camera.position.set(initCameraPos[0] / scale, initCameraPos[1] / scale, initCameraPos[2] / scale);
                scale /= 1.5;
                if (scale <= 1) {
                    zoomed = false;
                    clearInterval(zoomOutFunction);
                    controls.autoRotate = true;
                    controls.autoRotateSpeed = 8;
                    camera.position.set(initCameraPos[0], initCameraPos[1], initCameraPos[2]);
                    // if(mobileMode) {
                    //     document.getElementById("about-marquee-mobile").innerHTML = "double tap to zoom in, hold to pause";
                    // } 
                    // else {
                    //     document.getElementById("about-marquee-desktop").innerHTML = "[z]: zoom in, [spacebar]: pause";
                    // }
                }
            }, 50);
        } else {

            if (scale == 1) {
                initCameraPos = [camera.position.x, camera.position.y, camera.position.z];
            }
            if(!lazyloaded) {
                lazyloaded = true;
                let iframes = document.getElementsByTagName('iframe');
                for(let i = 0; i < iframes.length; i++) {
                    iframes[i].setAttribute('src', iframes[i].getAttribute('data-src'));
                    // iframes[i].setAttribute('src', iframes[i].getAttribute('data-src') + "&autoplay=1&loop=1&muted=1&autopause=0&background=1");
                }
            }

            let zoomInFunction = setInterval(function() {
                camera.position.set(initCameraPos[0] / scale, initCameraPos[1] / scale, initCameraPos[2] / scale);
                scale *= 1.5;
                if (scale >= 11) {
                    zoomed = true;
                    clearInterval(zoomInFunction);
                    controls.autoRotate = false;
                    description.style.display = "block";
                    // if(mobileMode) {
                    //     document.getElementById("about-marquee-mobile").innerHTML = "double tap to zoom out";
                    // } 
                    // else {
                    //     document.getElementById("about-marquee-desktop").innerHTML = "[z]: zoom out";
                    // }
                }
            }, 50);
        }
    }
}

function pause(event) {
    event.preventDefault();
    if ((event.keyCode == 32 && !zoomed) || mobileMode) {
        if (!paused) {
            controls.autoRotate = false;
            paused = true;
        } else {
            controls.autoRotate = true;
            paused = false;
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}