var camera, scene, renderer;
var controls;
var scale = 1;
var zoomed, spun, paused;
var current;
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
//var works = ['https://giphy.com/gifs/3ohjV3UwmJqANkoNR6/html5', 'https://giphy.com/gifs/3o6nV6gkigH6OcIAq4/html5', 'https://giphy.com/gifs/xUNda5x7YwPMdyuwLe/html5'];
var Element = function ( id, x, y, z, rx, ry ) {
    var div = document.createElement( 'div' );
    div.style.width = '480px';
    div.style.height = '480px';
    //div.style.backgroundColor = '#fff';
    // var img = document.createElement('img');
    // img.style.width = '480px';
    // img.style.height = '480px';
    // img.style.border = '0px';
    // img.style.opacity = "0.6";
    // img.style.border = "0px";
    //div.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';


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
    
    var iframe = document.createElement( 'iframe' );
    iframe.style.width = '480px';
    iframe.style.height = '480px';
    iframe.style.border = '0px';
    iframe.style.position = 'absolute';
    iframe.zIndex = "50";
    iframe.style.opacity = "0.8";
    
    switch(id) {
        case 0:
            iframe.src = "https://giphy.com/gifs/xUNda3nMOtOq7Y6re0/html5";
            break;
        case 1:
            iframe.src = "https://giphy.com/gifs/3ohjUWIm1rKgnB6CFW/html5";
            break;
        case 2:
            iframe.src = "https://giphy.com/gifs/l4Ep8jZ8U7dcKMjJK/html5";
            break;
        case 3:
            iframe.src = "https://giphy.com/gifs/3o6nULqm3pLiiUUntu/html5";
            break;
            
        default:
            descriptionId = "else";
    }
    div.appendChild( iframe );
    //div.appendChild(img);
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
    camera.position.set( cameraPos[0], cameraPos[1], cameraPos[2] );
    zoomed = false;
    spun = false;
    paused = false;
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
    group.add( new Element( 4, 0, 240, 0, -Math.PI/2, 0 ) );
    group.add( new Element( 5, 0, - 240, 0, Math.PI / 2, 0 ) );
    scene.add( group );
    controls = new THREE.OrbitControls( camera );
    controls.autoRotateSpeed = 8;
    controls.autoRotate = true;
    controls.enabled = false;
    window.addEventListener( 'resize', onWindowResize, false );
    window.addEventListener( 'keydown', zoom, false);
    window.addEventListener( 'keydown', spin, false);
    window.addEventListener( 'keydown', pause, false);
    //window.addEventListener( 'click', zoom, false);
    //window.addEventListener( 'click', (event)=>{controls.enabled = false;}, false);
    // Block iframe events when dragging camera
    // var blocker = document.getElementById( 'blocker' );
    // blocker.style.display = 'none';
    // document.addEventListener( 'mousedown', function () { blocker.style.display = ''; } );
    // document.addEventListener( 'mouseup', function () { blocker.style.display = 'none'; } );
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
                }
            }, 50);
        }
    }
}

function spin(event){
    event.preventDefault();
    if(( event.key == "s" || event.key == "S" ) && !zoomed){
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