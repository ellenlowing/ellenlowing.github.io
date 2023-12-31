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
    let img = document.createElement('img');
    img.style.width = '480px';
    img.style.height = '480px';
    img.style.border = '0px';
    img.style.opacity = "0.9";
    img.style.border = "0px";
    img.alt = "";
    let src = "assets/images/faces/";
    img.src = src + descriptionIds[id] + ".gif";
    div.appendChild(img);

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

    // debug
    zoom();
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

    // set up event listeners
    window.addEventListener('resize', onWindowResize, false);
    if(mobileMode) {
        window.addEventListener('touchend', detectTaps, false);
        document.getElementById('cross-btn').addEventListener('touchstart', zoom, false);
    } else {
        window.addEventListener('click', detectTaps, false);
        document.getElementById('cross-btn').addEventListener('click', zoom, false);
    }
    
    let tagSelectors = document.getElementsByClassName('tag-selector');
    for(let selector of tagSelectors)
    {
        selector.addEventListener('click', filterWork, false);
    }

    GLrenderer = new THREE.WebGLRenderer({ alpha: 1, antialias: true, clearColor: 0xffffff });
    GLrenderer.setSize(window.innerWidth, window.innerHeight);
    GLrenderer.domElement.style.position = 'absolute';
    GLrenderer.domElement.style.top = 0;
    container.appendChild(GLrenderer.domElement);

}

function detectTaps(event) {
    if(!zoomed)
    {
        zoom(event);
    }
}

function zoom(event) {
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
            }
        }, 50);
    }
}

function pause(event) {
    if(!zoomed) {
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

function filterWork(e)
{
    e.target.classList.toggle("active");
    let activeTags = document.querySelectorAll('.tag-selector.active');
    let work = document.querySelectorAll('.work');
    
    if(activeTags.length == 0)
    {
        for(let el of work)
        {
            el.style.display = 'block';
        }
    }
    else
    {
        let activeTagClassNames = [];
        for(let tag of activeTags)
        {
            activeTagClassNames.push(`${tag.getAttribute("data-classname")}`);

        }

        for(let el of work)
        {
            let isActive = false;
            for(let tag of activeTagClassNames)
            {
                if(el.classList.contains(tag))
                {
                    isActive = true;
                    break;
                }
            }

            if(isActive)
            {
                el.style.display = 'block';
            }
            else
            {
                el.style.display = 'none';
            }
        }
    }
}