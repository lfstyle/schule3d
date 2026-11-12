// Wiederverwendbare Bürobauteile. Lokale Vorderseite +z, Ursprung am Boden.
import * as THREE from 'three';
import { matrixFrom } from './geometry.js';

export function addOfficeCabinet(b,M,{width=1,height=2.1,depth=.48,material=M.flur4Wood,doors=2}={}){
  b.box(material,width,height-.08,depth,0,(height+.08)/2,0);
  b.box(M.flur4Skirt,width-.04,.075,depth-.035,0,.0375,0);
  for(let i=0;i<doors;i++){
    const w=width/doors,x=-width/2+w*(i+.5),hy=Math.min(1.1,height-.15);
    b.box(material,w-.012,height-.12,.018,x,(height+.08)/2,depth/2+.012);
    const hx=x+(i%2?-1:1)*(w/2-.07);
    b.rod(M.chrome,[hx,hy-.07,depth/2+.055],[hx,hy+.07,depth/2+.055],.009,8);
    for(const yy of [hy-.07,hy+.07])b.rod(M.chrome,[hx,yy,depth/2+.024],[hx,yy,depth/2+.055],.008,8);
  }
}

export function addReceptionCounter(b,M,{width=4.4}={}){
  const curve=x=>-.17*x*x,half=width/2;
  function slab(y,depth,thickness){
    const shape=new THREE.Shape();const n=32;
    for(let i=0;i<=n;i++){const x=-half+width*i/n;const z=curve(x)+depth/2;i?shape.lineTo(x,-z):shape.moveTo(x,-z);}
    for(let i=n;i>=0;i--){const x=-half+width*i/n;shape.lineTo(x,-curve(x)+depth/2);}
    shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,curveSegments:24});geo.rotateX(-Math.PI/2);
    b.add(M.flur4Wood,geo,matrixFrom(0,y,0));
  }
  slab(.725,.77,.035);slab(1.08,.34,.035);
  for(let i=0;i<6;i++){
    const x=-half+(i+.5)*width/6,z=curve(x),ry=Math.atan(.34*x);
    b.push(x,0,z,ry);
    b.box(i%3===0?M.flur4Wood:M.flur4Perforated,width/6-.014,.59,.025,0,.39,.25);
    b.box(M.flur4Perforated,width/6-.014,.22,.022,0,.92,.07);
    b.box(M.flur4Wood,.024,.28,.14,-width/12+.014,.93,0);
    b.pop();
  }
  for(let i=0;i<=6;i++){
    const x=-half+width*i/6,z=curve(x)+.18;
    b.cylinder(M.flur4Red,.018,.018,1.08,x,.54,z,10);
    b.cylinder(M.flur4Red,.06,.06,.016,x,.008,z,12);
  }
  for(const x of [-1.5,.2,1.55]){
    const z=curve(x);b.cylinder(M.steelBlack,.045,.055,.015,x,1.125,z,12);
    b.rod(M.steelBlack,[x,1.13,z],[x+.015,1.29,z],.006,7);
  }
  b.box(M.flur3Glass,1.35,.65,.005,.3,1.455,-.11);
  for(const x of [-.3,.9])b.box(M.chrome,.035,.025,.15,x,1.125,-.11);
  b.cylinder(M.flur3Glass,.06,.045,.30,1.4,1.27,curve(1.4)-.04,12);
  for(let i=0;i<5;i++){const x=1.4+(i-2)*.015,z=curve(1.4);b.rod(M.flur3Leaf,[x,1.15,z],[x+.03,1.65+i*.018,z],.004,5);b.cylinder(M.flur4Red,.025,.018,.045,x+.03,1.65+i*.018,z,7);}
}

export function addCopier(b,M){
  b.box(M.steelBlack,.72,.82,.69,0,.45,0);b.box(M.panelGrey,.18,.77,.65,.43,.44,0);
  for(const y of [.22,.44,.65]){b.box(M.flur4Column,.62,.16,.02,0,y,.356);b.box(M.steelBlack,.19,.018,.03,0,y+.04,.375);}
  b.box(M.flur4Column,.74,.13,.65,0,.94,-.04);b.box(M.steelBlack,.61,.11,.47,-.03,1.06,-.08);
  b.box(M.panelGrey,.34,.025,.22,.41,.89,.37,0,0,-.2);b.box(M.flur4TV,.20,.01,.13,.41,.91,.37,0,0,-.2);
  b.box(M.steelBlack,.50,.035,.26,-.37,.81,.08);b.box(M.paper,.20,.018,.28,-.35,.835,.08);
}
