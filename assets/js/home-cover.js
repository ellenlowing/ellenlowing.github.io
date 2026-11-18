(() => {
  const cover = document.querySelector('.home-cover');
  const container = cover.querySelector('.cube-scene');
  let scrollFrame;
  const scrollToWork = () => {
    cancelAnimationFrame(scrollFrame);
    const work = document.querySelector('#work-home');
    const start = window.scrollY;
    const destination = start + work.getBoundingClientRect().top;
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, destination);
      document.documentElement.style.scrollBehavior = previous;
      return;
    }
    const started = performance.now();
    const tick = now => {
      const t = Math.min((now - started) / 1300, 1);
      const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, start + (destination - start) * eased);
      if (t < 1) scrollFrame = requestAnimationFrame(tick);
      else {
        window.scrollTo(0, window.scrollY + work.getBoundingClientRect().top);
        document.documentElement.style.scrollBehavior = previous;
      }
    };
    scrollFrame = requestAnimationFrame(tick);
  };
  cover.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link?.classList.contains('cover-scroll')) {
      event.preventDefault(); scrollToWork(); return;
    }
    if (event.target.closest('a,button,input,textarea,select')) return;
    scrollToWork();
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(100, cover.clientWidth / cover.clientHeight, 1, 1000);
  camera.position.set(600, 0, 500);
  const renderer = new THREE.CSS3DRenderer();
  renderer.setSize(cover.clientWidth, cover.clientHeight);
  container.append(renderer.domElement);
  const group = new THREE.Group();
  const faces = [
    ['Experimental',0,0,240,0],['Design',240,0,0,Math.PI/2],
    ['Hardware',0,0,-240,Math.PI],['Interactive',-240,0,0,-Math.PI/2]
  ];
  faces.forEach(([name,x,y,z,rotation]) => {
    const face = document.createElement('div');
    face.style.cssText='width:480px;height:480px';
    const image = document.createElement('img');
    image.src=`/assets/images/faces/${name}.gif`;
    image.alt='';image.style.cssText='display:block;width:480px;height:480px';
    face.append(image);
    const object = new THREE.CSS3DObject(face);
    object.position.set(x,y,z);object.rotation.y=rotation;group.add(object);
  });
  scene.add(group);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.autoRotateSpeed=8;controls.autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.enabled=false;
  let visible=true;
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe(cover);
  const render=()=>{requestAnimationFrame(render);if(visible&&!document.hidden){controls.update();renderer.render(scene,camera)}};
  render();
  new ResizeObserver(()=>{
    camera.aspect=cover.clientWidth/cover.clientHeight;camera.updateProjectionMatrix();
    renderer.setSize(cover.clientWidth,cover.clientHeight);
  }).observe(cover);
})();
