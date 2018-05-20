var camera, scene, GLrenderer;
var controls;
var baseBoneRotation = ( new THREE.Quaternion ).setFromEuler( new THREE.Euler( 0, 0, Math.PI / 2 ) );
var armMeshes = [];
var boneMeshes = [];
init();
Leap.loop( {background: true, enableGestures: true}, leapAnimate ).connect();

function init() {
	var container = document.getElementById( 'container' );
    camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 1, 5000 );
    camera.position.set( cameraPos[0], cameraPos[1], cameraPos[2] );
    scene = new THREE.Scene();
    controls = new THREE.OrbitControls( camera );
    controls.autoRotateSpeed = 8;
    controls.autoRotate = true;
    controls.enabled = false;

    GLrenderer = new THREE.WebGLRenderer( { alpha: 1, antialias: true, clearColor: 0xffffff }  );
    GLrenderer.setSize( window.innerWidth, window.innerHeight );
    GLrenderer.domElement.style.position = 'absolute';
    GLrenderer.domElement.style.top = 0;
    container.appendChild( GLrenderer.domElement );
}

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
                console.log(gesture.speed);   
            }
        }
    }

    GLrenderer.render( scene, camera );
    controls.update();
}