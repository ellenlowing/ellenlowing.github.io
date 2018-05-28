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

// var baseBoneRotation = ( new THREE.Quaternion ).setFromEuler( new THREE.Euler( 0, 0, Math.PI / 2 ) );
// var armMeshes = [];
// var boneMeshes = [];
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
window.onload = function(){
    console.log("Finish loading");
}
// init();
// //Leap.loop( {background: true, enableGestures: true}, leapAnimate ).connect();
// animate();
function init() {
    isMobile();
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
//     // var initZoomFunction = setInterval( function(){
//     //     camera.position.set(cameraPos[0]*initZoomScale, cameraPos[1]*initZoomScale, cameraPos[2]*initZoomScale);
//     //     initZoomScale -= 1;
//     //     if(initZoomScale < 1){
//     //         clearInterval(initZoomFunction);
//     //         controls.autoRotate = true;
//     //     }
//     // }, 50);
//     // setTimeout(initZoomFunction, 1000);

//     window.mobilecheck = function() {
//       var check = false;
//       (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
//       return check;
//     };

    
    window.addEventListener( 'resize', onWindowResize, false );
    window.addEventListener( 'keydown', zoom, false);
    window.addEventListener( 'keydown', spin, false);
    window.addEventListener( 'keydown', pause, false);
    window.addEventListener( 'keydown', aboutme, false);
    window.addEventListener( 'keydown', last, false);
    window.addEventListener( 'keydown', next, false);

    GLrenderer = new THREE.WebGLRenderer( { alpha: 1, antialias: true, clearColor: 0xffffff }  );
    GLrenderer.setSize( window.innerWidth, window.innerHeight );
    GLrenderer.domElement.style.position = 'absolute';
    GLrenderer.domElement.style.top = 0;
    container.appendChild( GLrenderer.domElement );
}


function zoom(event){
    event.preventDefault();
    if(event.key == "z" || event.key == "s" && spun){
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
                    document.getElementById("text-guide").innerHTML = "[z]: zoom in, [s]: spin, [spacebar]: pause, [e]: for ellen";
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
                    document.getElementById("text-guide").innerHTML = "[z]: zoom out, [&larr;]: previous, [&rarr;]: next";
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

function pauseClick(event){
    event.preventDefault();
    //console.log("clicked");
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

/*
function addMesh( meshes ) {
    var geometry = new THREE.BoxGeometry( 1, 1, 1 );
    var material = new THREE.MeshNormalMaterial();
    var mesh = new THREE.Mesh( geometry, material );
    meshes.push( mesh );
    return mesh;
}

function updateMesh( bone, mesh ) {
    mesh.position.fromArray( bone.center() );
    mesh.setRotationFromMatrix( ( new THREE.Matrix4 ).fromArray( bone.matrix() ) );
    mesh.quaternion.multiply( baseBoneRotation );
    mesh.scale.set( bone.width, bone.width, bone.length );
    scene.add( mesh );
}

function leapAnimate( frame ) {
    var countBones = 0;
    var countArms = 0;
    armMeshes.forEach( function( item ) { scene.remove( item ) } );
    boneMeshes.forEach( function( item ) { scene.remove( item ) } );
    for ( var hand of frame.hands ) {
        for ( var finger of hand.fingers ) {
            for ( var bone of finger.bones ) {
                if ( countBones++ === 0 ) { continue; }
                var boneMesh = boneMeshes [ countBones ] || addMesh( boneMeshes );
                updateMesh( bone, boneMesh );
            }
        }
        var arm = hand.arm;
        var armMesh = armMeshes [ countArms++ ] || addMesh( armMeshes );
        updateMesh( arm, armMesh );
        armMesh.scale.set( arm.width / 4, arm.width / 2, arm.length );
    }
    if(frame.gestures.length > 0){
        for(var i = 0; i < frame.gestures.length; i++){
            var gesture = frame.gestures[i];
            if(gesture.type == "swipe") {
                //console.log(gesture.speed);   
            }
        }
    }

    GLrenderer.render( scene, camera );
    controls.update();
}
*/

function isMobile() {
    if(navigator.userAgent.indexOf("Mobile") == -1) console.log("this is NOT a mobile device");
    else {
        console.log("this is a mobile device");
        var text = document.getElementById("text-guide");
        text.innerHTML = "this is a mobile device";
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