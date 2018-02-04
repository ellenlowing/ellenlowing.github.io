var camera, scene, renderer;
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
var descriptionIds = ["openFrameworks", "Design", "Hardware", "VirtualReality", "", ""];
//lowerx, upperx, lowerz, upperz;
var cameraPos = [600, 200, 500];
var initCameraPos;
var group;
var description;
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
    console.log(img.src);
    // div.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';


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
    
    // var iframe = document.createElement( 'iframe' );
    // iframe.style.width = '480px';
    // iframe.style.height = '480px';
    // iframe.style.border = '0px';
    // iframe.style.position = 'absolute';
    // iframe.zIndex = "50";
    // iframe.style.opacity = "0.8";
    
    // switch(id) {
    //     case 0:
    //         iframe.src = "https://giphy.com/gifs/xUNda3nMOtOq7Y6re0/html5";
    //         break;
    //     case 1:
    //         iframe.src = "https://giphy.com/gifs/3ohjUWIm1rKgnB6CFW/html5";
    //         break;
    //     case 2:
    //         iframe.src = "https://giphy.com/gifs/l4Ep8jZ8U7dcKMjJK/html5";
    //         break;
    //     case 3:
    //         img.src = "assets/images/faces/giphy.gif";
    //         img.alt = "";
    //         break;
            
    //     default:
    //         descriptionId = "else";
    // }
    //div.appendChild( iframe );
    div.appendChild(img);
    div.appendChild(p);
    // a.appendChild(img);
    // a.addEventListener("click", function(event){alert(id);}, false);
    // var iframe = document.createElement( 'iframe' );
    // iframe.style.width = '480px';
    // iframe.style.height = '480px';
    // iframe.style.border = '0px';
    // iframe.src = works[id%3];
    // div.appendChild( iframe );
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
    // camera.position.set( cameraPos[0]*100, cameraPos[1]*100, cameraPos[2]*100 );
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
    // group.add( new Element( 4, 0, 240, 0, -Math.PI/2, 0 ) );
    // group.add( new Element( 5, 0, - 240, 0, Math.PI / 2, 0 ) );
    scene.add( group );
    controls = new THREE.OrbitControls( camera );
    controls.autoRotateSpeed = 8;
    controls.autoRotate = true;
    controls.enabled = false;
    var initZoomScale = 19;
    // var initZoomFunction = setInterval( function(){
    //     camera.position.set(cameraPos[0]*initZoomScale, cameraPos[1]*initZoomScale, cameraPos[2]*initZoomScale);
    //     initZoomScale -= 1;
    //     if(initZoomScale < 1){
    //         clearInterval(initZoomFunction);
    //         controls.autoRotate = true;
    //     }
    // }, 50);
    // setTimeout(initZoomFunction, 1000);
    
    window.addEventListener( 'resize', onWindowResize, false );
    window.addEventListener( 'keydown', zoom, false);
    window.addEventListener( 'keydown', spin, false);
    window.addEventListener( 'keydown', pause, false);
    window.addEventListener( 'keydown', aboutme, false);
    //window.addEventListener( 'onclick', pauseClick, false);
}

function zoom(event){
    event.preventDefault();
    if(event.key == "z" || event.key == "s" && spun){
        if(zoomed){
            
            description.style.display = "none";
            //camera.position.set( tempCameraPos.x, tempCameraPos.y, tempCameraPos.z);
            var zoomOutFunction = setInterval( function(){
            	//camera.position.set( tempCameraPos.x/scale, tempCameraPos.y/scale, tempCameraPos.z/scale );
                camera.position.set(initCameraPos[0]/scale, initCameraPos[1]/scale, initCameraPos[2]/scale);
                scale/=1.5;
                if(scale <= 1){
                	zoomed = false;
                    clearInterval(zoomOutFunction);
                    controls.autoRotate = true;
                    controls.autoRotateSpeed = 8;
                    camera.position.set( initCameraPos[0], initCameraPos[1], initCameraPos[2] );
                    document.getElementById("text-guide").innerHTML = "[z]: zoom in, [s]: spin, [spacebar]: pause, [e]: for ellen";
                    
                    // document.getElementById("spin").style.textDecoration = "none";
                    // document.getElementById("pause").style.textDecoration = "none";
                    // document.getElementById("forEllen").style.textDecoration = "none";
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
                    console.log(current);
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
                    
                    // document.getElementById("spin").style.textDecoration = "line-through";
                    // document.getElementById("pause").style.textDecoration = "line-through";
                    // document.getElementById("forEllen").style.textDecoration = "line-through";
                    document.getElementById("text-guide").innerHTML = "[z]: zoom out";
                }
            }, 50);
        }
    }
}

function spin(event){
    event.preventDefault();
    if(( event.key == "s" || event.key == "S" ) && !zoomed){
        if(paused) {
            controls.autoRotate = true;
            paused = false;
        }
        controls.autoRotateSpeed = 500;
        var autoSpinFunc = setInterval( function(){
            controls.autoRotateSpeed/=1.5;
            if(controls.autoRotateSpeed < 2){
                clearInterval(autoSpinFunc);
                controls.autoRotateSpeed = 0;
                spun = true;
                zoom(event);
            }
        }, 500);
    }
}

function pause(event){
    event.preventDefault();
    if(event.keyCode == 32 && !zoomed){
        if(!paused){
            controls.autoRotate = false;
            paused = true;
        }else{
            controls.autoRotate = true;
            paused = false;
        }
    }
}

function pauseClick(event){
    event.preventDefault();
    console.log("clicked");
    // if(event.keyCode == 32 && !zoomed){
        if(!paused){
            controls.autoRotate = false;
            paused = true;
        }else{
            controls.autoRotate = true;
            paused = false;
        }
    // }
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
            //console.log(popup.style.left + " " + popup.style.top);

        }, false);
        aName.addEventListener('mouseleave', function(event) {
            popup.style.display = "none"; //console.log("mouseleave");
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
                aEmail.href = "mailto:lowing@bu.edu";
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