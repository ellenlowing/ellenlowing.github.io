var camera, scene, renderer;
var GLrenderer;
var controls;
var scale = 1;
var zoomed, spun, paused, nameRendered;
var current;
var mflag;
var cameraLimits = [[-0.7, 0.7, -1, -0.5],
                    [-1, -0.5, -0.7, 0.7],
                    [-0.8, 0.8, 0.5, 1],
                    [0.5, 1, -0.8, 0.8]
                    ];
var descriptionIds = ["Experimental", "Design", "Hardware", "Interactive"];
var descriptionInit = [0, 0, 0, 0];
var cameraPos = [600, 200, 500];
var initCameraPos;
var group;
var description;
var device;

var Element = function ( id, x, y, z, rx, ry ) {
    var div = document.createElement( 'div' );
    div.style.width = '480px';
    div.style.height = '480px';
    //div.style.backgroundColor = '#fff';
    var img = document.createElement('img');
    img.style.width = '480px';
    img.style.height = '480px';
    img.style.border = '0px';
    img.style.opacity = "0.8";
    img.style.border = "0px";
    img.alt = "";
    var src = "assets/images/faces/";
    img.src = src + descriptionIds[id] + ".gif";

    var p = document.createElement('p');
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
    div.appendChild(p);

    var object = new THREE.CSS3DObject( div );
    object.position.set( x, y, z );
    object.rotation.x = rx;
    object.rotation.y = ry;
    return object;
};

init();
animate();

function init() {
    var container = document.getElementById( 'container' );
    camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 1, 5000 );
    camera.position.set( cameraPos[0], cameraPos[1], cameraPos[2] );
    zoomed = false;
    spun = false;
    paused = false;
    mflag = false;
    nameRendered = false;
    scene = new THREE.Scene();
    renderer = new THREE.CSS3DRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = 0;
    container.appendChild( renderer.domElement );
    group = new THREE.Group();
    group.add( new Element( 0, 0, 0, 240, 0, 0 ) );
    group.add( new Element( 1, 240, 0, 0, 0, Math.PI / 2 ) );
    group.add( new Element( 2, 0, 0, - 240, 0,Math.PI ) );
    group.add( new Element( 3, - 240, 0, 0, 0, - Math.PI / 2 ) );
    scene.add( group );
    controls = new THREE.OrbitControls( camera );
    controls.autoRotateSpeed = 8;
    controls.autoRotate = true;
    controls.enabled = false;
    var initZoomScale = 19;

    window.addEventListener( 'touchend', detectTap, false);
    window.addEventListener( 'touchmove', detectSwipeEnd, false);
    window.addEventListener( 'touchstart', detectSwipe, false);

    GLrenderer = new THREE.WebGLRenderer( { alpha: 1, antialias: true, clearColor: 0xffffff }  );
    GLrenderer.setSize( window.innerWidth, window.innerHeight );
    GLrenderer.domElement.style.position = 'absolute';
    GLrenderer.domElement.style.top = 0;
    container.appendChild( GLrenderer.domElement );
}

var lastTap = 0;
var timeout;
var touchStartPointX;
var touchEndPointX;

function detectTap(event){
    var currentTime = new Date().getTime();
    var tapLength = currentTime - lastTap;
    clearTimeout(timeout);
    if (tapLength < 300 && tapLength > 0) {
        event.preventDefault();
        zoom(event);
    } else {
        if(!zoomed) pause(event);
        timeout = setTimeout(function() {
            clearTimeout(timeout);
        }, 300);
    }
    lastTap = currentTime;
}

function detectSwipeEnd(event){
    event.preventDefault();
    if(zoomed){
        var touchEndPointX = event.targetTouches[0].clientX;
        console.log("end:" + touchEndPointX);
        var swipeDistance = touchEndPointX - touchStartPointX;
        console.log("swipeDistance" + swipeDistance);
        if(swipeDistance > 100){
            next();
        } else if (swipeDistance < -100){
            last();
        }
        touchStartPointX = 0;
        touchEndPointX = 0;
    }
}

function detectSwipe(event){
    event.preventDefault();
    if(zoomed){
        touchStartPointX = event.targetTouches[0].clientX;
        console.log("start:" + touchStartPointX);
    }
}

function zoom(event){
    event.preventDefault();
    if(zoomed){
        description.style.display = "none";
        var zoomOutFunction = setInterval( function(){
            camera.position.set(initCameraPos[0]/scale, initCameraPos[1]/scale, initCameraPos[2]/scale);
            scale/=1.5;
            if(scale <= 1){
            	zoomed = false;
                clearInterval(zoomOutFunction);
                controls.autoRotate = true;
                controls.autoRotateSpeed = 8;
                camera.position.set( initCameraPos[0], initCameraPos[1], initCameraPos[2] );
                document.getElementById("text-guide").innerHTML = "[double tap]: zoom in, [single tap]: pause, [e]: for ellen";
            }
        }, 50);
    }else{
        spun = false;
        if(scale == 1){
        	initCameraPos = [camera.position.x, camera.position.y, camera.position.z];
        }
        var direction = camera.getWorldDirection();
        for(var i = 0; i<cameraLimits.length; i++){
            if(direction.x <= cameraLimits[i][1] && direction.x >=cameraLimits[i][0] && direction.z >= cameraLimits[i][2] && direction.z <= cameraLimits[i][3]){
                current = descriptionIds[i];
                description = document.getElementById(current.toString());
                if(descriptionInit[i] === 0){
                    descriptionInit[i] = 1;
                    var iframeClass = "iframe-" + current;
                    var iframes = document.getElementsByClassName(iframeClass);
                    for(var j = 0; j<iframes.length; j++){
                        iframes[j].setAttribute('src', iframes[j].getAttribute('data-src'));
                    } 
                }
                break;
            }else{
                continue;
            }
        }
        var zoomInFunction = setInterval( function(){
            camera.position.set( initCameraPos[0]/scale, initCameraPos[1]/scale, initCameraPos[2]/scale);
            scale*=1.5;
            if(scale >= 11){
                zoomed = true;
                clearInterval(zoomInFunction);
                controls.autoRotate = false;
                description.style.display = "block";
                document.getElementById("text-guide").innerHTML = "[double tap]: zoom out, [swipe left]: previous, [swipe right]: next";
            }
        }, 50);
    }
}

// function spin(event){
//     event.preventDefault();
//     if(( event.key == "s" || event.key == "S" ) && !zoomed){
//         if(paused) {
//             controls.autoRotate = true;
//             paused = false;
//         }
//         controls.autoRotateSpeed = 500;
//         var autoSpinFunc = setInterval( function(){
//             controls.autoRotateSpeed/=1.5;
//             if(controls.autoRotateSpeed < 2){
//                 clearInterval(autoSpinFunc);
//                 controls.autoRotateSpeed = 0;
//                 spun = true;
//                 zoom(event);
//             }
//         }, 500);
//     }
// }

function pause(event){
    event.preventDefault();
    if(!paused){
        controls.autoRotate = false;
        paused = true;
    }else{
        controls.autoRotate = true;
        paused = false;
    }
}

function last(event){
    event.preventDefault();
    if(event.keyCode == 37 && zoomed){
        description.style.display = "none";
        var currentIndex = descriptionIds.findIndex(currentId => currentId === current);
        currentIndex -= 1;
        if(currentIndex < 0){
            currentIndex = 3;
        }
        current = descriptionIds[currentIndex];
        if(descriptionInit[currentIndex] === 0){
            descriptionInit[currentIndex] = 1;
            var iframeClass = "iframe-" + current;
            var iframes = document.getElementsByClassName(iframeClass);
            for(var i = 0; i<iframes.length; i++){
                iframes[i].setAttribute('src', iframes[i].getAttribute('data-src'));
            } 
        }
        description = document.getElementById(current.toString());
        description.style.display = "block";

    }
}

function next(event){
    event.preventDefault();
    if(event.keyCode == 39 && zoomed){
        description.style.display = "none";
        var currentIndex = descriptionIds.findIndex(currentId => currentId === current);
        currentIndex += 1;
        if(currentIndex > 3){
            currentIndex = 0;
        }
        current = descriptionIds[currentIndex];
        if(descriptionInit[currentIndex] === 0){
            descriptionInit[currentIndex] = 1;
            var iframeClass = "iframe-" + current;
            var iframes = document.getElementsByClassName(iframeClass);
            for(var i = 0; i<iframes.length; i++){
                iframes[i].setAttribute('src', iframes[i].getAttribute('data-src'));
            } 
        }
        description = document.getElementById(current.toString());
        description.style.display = "block";
    }
}

function aboutme(event){
    event.preventDefault();
    if((event.key == 'e' || event.key == 'E') && !zoomed && !spun && !nameRendered){
        nameRendered = true;
        var abouttext = document.getElementById("about-text");
        var counter = 0;
        var name = "ellen lo";
        var aName = document.createElement('a');
        var textNodeName = document.createTextNode('');
        aName.appendChild(textNodeName);
        aName.href = "index.html";
        aName.target = "";

        var popup = document.getElementById("about-popup");
        aName.addEventListener('mouseover', function(event) {
            popup.style.display = "flex";
            popup.style.left = (Math.random() * (window.innerWidth - popup.offsetWidth - 200) - 120 ).toString() + "px";
            popup.style.top = (Math.random() * (window.innerHeight - popup.offsetHeight)).toString() + "px";
            
        }, false);
        aName.addEventListener('mouseleave', function(event) {
            popup.style.display = "none"; 
        }, false);

        var addNameFunc = setInterval(function(){

            aName.innerHTML += name[counter];
            abouttext.appendChild(aName);
            counter++;

            if(counter >= name.length) {
                clearInterval(addNameFunc);
                
                var span_3 = document.createElement('span');
                var slash_3 = document.createTextNode(" / ");
                abouttext.appendChild(slash_3);
               
                var counter_email = 0;
                var email = "email";
                var aEmail = document.createElement('a');
                var textNodeEmail = document.createTextNode('');
                aEmail.appendChild(textNodeEmail);
                aEmail.href = "mailto:lowing@bu.edu?subject=Hi%20Ellen!";
                aEmail.target = "_top";
                var addEmailFunc = setInterval(function(){
                    aEmail.innerHTML += email[counter_email];
                    abouttext.appendChild(aEmail);
                    counter_email++;
                    if(counter_email >= email.length){
                        clearInterval(addEmailFunc);
                        var span = document.createElement('span');
                        var slash = document.createTextNode(" / ");
                        abouttext.appendChild(slash);

                        var counter_resume = 0;
                        var resume = "cv";
                        var a = document.createElement('a');
                        var textNode = document.createTextNode('');
                        a.appendChild(textNode);
                        a.href = "assets/EllenLoResume.pdf";
                        a.target = "_blank";
                        var addResumeFunc = setInterval(function(){
                            a.innerHTML += resume[counter_resume];
                            abouttext.appendChild(a);
                            counter_resume++;
                            if(counter_resume >= resume.length){
                                clearInterval(addResumeFunc);
                                var span_2 = document.createElement('span');
                                var slash_2 = document.createTextNode(" / ");
                                abouttext.appendChild(slash_2);

                                var counter_github = 0;
                                var github = "github";
                                var aGit = document.createElement('a');
                                var textNodeGit = document.createTextNode('');
                                aGit.appendChild(textNode);
                                aGit.href = "https://github.com/ellenlowing";
                                aGit.target = "_blank";
                                var addGithubFunc = setInterval(function(){
                                    aGit.innerHTML += github[counter_github];
                                    abouttext.appendChild(aGit);
                                    counter_github++;
                                    if(counter_github >= github.length){
                                        clearInterval(addGithubFunc);
                                    }
                                }, Math.random() * (200-100) + 100);
                            }
                        }, Math.random() * (200-100) + 100);
                    }
                }, Math.random() * (200-100) + 100);
            }
        }, Math.random() * (200-100) + 100);

    }
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    requestAnimationFrame( animate );
    controls.update();
    renderer.render( scene, camera );
}