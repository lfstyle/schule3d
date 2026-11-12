// Flur 4 am höheren Treppenabsatz und öffentlicher Verwaltungsbereich (Sekretariat 228).
// 34 einzeln geprüfte Fotos, Schätzmaße/Abgrenzung: verification/FLUR4-ABGLEICH.md.
import * as THREE from 'three';
import { PartBuilder, matrixFrom, metricBoxUV } from '../geometry.js';
import { addWall, addWindow, Door, addSwitchPlate, addCeilingLight, addVerticalRadiator,
  createWallClock, createChair, addSchoolTable } from '../objects.js';
import { addOfficeCabinet, addReceptionCounter, addCopier } from '../office-objects.js';
import { Toggle } from '../animated.js';
import { FLUR3 } from '../flur3-layout.js';

export const FLUR4={y:FLUR3.upper,roof:FLUR3.stairRoof,west:8.3,east:12.4,north:-6.85,south:2.8};
// Sekretariat: Empfang hinter der Glasfront, Schrankgang nach Westen (Fenster am Ende), Bürogang
// parallel zu Flur 4; seine Ostwand setzt die Empfangs-Ostwand gerade fort (Nutzerskizze 16.10.).
export const SEKRETARIAT={x0:0,wc:8.5,x1:14.98,gx:12.58,n:-13.1,front:-7.03,gs:-10.9,end:4.6};

export function buildFlur4(ctx){
  const {scene,collision:C,materials:M,lighting,interactions,registerObject,audio,map}=ctx;
  const F=FLUR4,S=SEKRETARIAT,Y=F.y,H=F.roof-Y,root=new THREE.Group();root.name='flur_4';scene.add(root);
  const walls=new PartBuilder(),b=new PartBuilder(),fixtures=new PartBuilder(),updates=[];
  const anchor=(id,type,name,obj)=>{obj??=new THREE.Object3D();if(!obj.parent)root.add(obj);registerObject(id,type,name,obj);return obj;};
  const plane=(mat,w,h,x,y,z,ry=0)=>b.add(mat,new THREE.PlaneGeometry(w,h),matrixFrom(x,y,z,0,ry));
  function surface(mat,x0,z0,x1,z1,y,down=false,tile=1){
    const geo=new THREE.PlaneGeometry(x1-x0,z1-z0);geo.rotateX(down?Math.PI/2:-Math.PI/2);geo.translate((x0+x1)/2,y,(z0+z1)/2);metricBoxUV(geo,tile);
    const m=new THREE.Mesh(geo,mat);m.receiveShadow=true;root.add(m);return m;
  }
  function floor(x0,z0,x1,z1,mat=M.flur4Floor){surface(mat,x0,z0,x1,z1,Y,false,mat===M.flur3Floor?2:1);C.addBox(x0,z0,x1,z1,Y-.12,Y,{tag:'boden',surface:'lino'});}
  // red: true = lockeres Muster (Flur 4), Funktion (x,z) = gezielte rote Platten.
  function ceiling(x0,z0,x1,z1,red=false){
    surface(M.ceilingPlain,x0,z0,x1,z1,F.roof,true,.6);surface(M.foyerRoof,x0,z0,x1,z1,F.roof+.12).castShadow=true;
    C.addBox(x0,z0,x1,z1,F.roof,F.roof+.13,{tag:'decke'});
    for(let x=x0+.62;x<x1;x+=.625)b.box(M.aluminium,.012,.014,z1-z0,x,F.roof-.009,(z0+z1)/2);
    for(let z=z0+.62;z<z1;z+=.625)b.box(M.aluminium,x1-x0,.014,.012,(x0+x1)/2,F.roof-.009,z);
    if(red)for(let i=0;i<Math.floor((x1-x0)/.625);i++)for(let j=0;j<Math.floor((z1-z0)/.625);j++){
      const x=x0+(i+.5)*.625,z=z0+(j+.5)*.625;
      if(typeof red==='function'?red(x,z):(i+j*2)%7===0)b.box(M.flur4Red,.60,.008,.60,x,F.roof-.022,z);
    }
  }
  function wall(a,d,openings=[],dado=false){
    const w=addWall(walls,{...M,baseboard:dado?M.flur3Skirt:M.flur4Skirt},{start:a,end:d,height:H,thickness:.18,y0:Y,openings,material:M.flur4Wall});
    w.colliders.forEach(c=>C.add({...c,tag:'wand'}));map.walls.push(...w.segments);
    if(dado){b.push(a[0],Y,a[1],w.rot);let u=0;for(const o of [...openings.filter(o=>o.y<.05).sort((a,b)=>a.u-b.u),{u:w.length,w:0}]){if(o.u>u)b.box(M.flur2Dado,o.u-u,.88,.008,(u+o.u)/2,.44,.006);u=o.u+o.w;}b.pop();}
  }
  function sign(mat,x,z,ry=0,w=.22,h=.18,y=1.6){
    b.push(x,Y+y,z,ry);plane(mat,w,h,0,0,.025);
    for(const xx of [-w/2+.015,w/2-.015])for(const yy of [-h/2+.015,h/2-.015])b.cylinder(M.chrome,.007,.007,.012,xx,yy,.03,8,Math.PI/2);b.pop();
  }
  // Türgruppe steht auf der Wandlinie, +z (ry) zeigt in den Raum der Wandinnenseite.
  function door(id,name,x,z,ry,{transom=false,mat=M.flur3Frame,interactive=false,wide=1.02,hinge='right',glass=M.flur4Milk,swing=1,open=false,normal=[0,-1],leaf=M.flur4Wood}={}){
    const d=new Door({...M,glass},{id,hinge,width:wide,openingWidth:wide+.12,openingHeight:transom?H:2.25,leafHeight:2.18,transom,
      frontMaterial:leaf,backMaterial:leaf,leafMaterial:leaf,frameMaterial:mat,wallThickness:.18,casingBack:interactive});
    d.group.position.set(x,Y,z);d.group.rotation.y=ry;root.add(d.group);anchor(id,'door',name,d.group);
    if(!interactive){C.add({x,z,w:wide+.12,d:.20,rot:ry,bottom:Y,top:transom?F.roof:Y+2.25,tag:'tuer',id});return d;}
    const block=C.add({x,z,w:wide,d:.065,rot:ry,bottom:Y,top:Y+2.18,tag:'tuer',id}),p=new THREE.Vector3();
    const t=new Toggle({duration:.8,open,apply:k=>{d.pivot.rotation.y=swing*1.48*k;d.group.updateMatrixWorld(true);d.leaf.getWorldPosition(p);C.update(block,{x:p.x,z:p.z,rot:ry+d.pivot.rotation.y});}});
    updates.push(t);d.group.userData.toggle=t;
    interactions.register(d.group,{id,type:'door',label:()=>name+(t.isOpen?' schließen':' öffnen'),onInteract:()=>audio.door(t.toggle())});
    // Feste Zarge/Oberlicht bleiben auch bei geöffnetem Blatt Hindernisse.
    const c=Math.cos(ry),s=Math.sin(ry);
    for(const side of [-1,1])C.add({x:x+c*side*(wide/2+.04),z:z-s*side*(wide/2+.04),w:.08,d:.22,rot:ry,bottom:Y,top:F.roof,tag:'zarge'});
    C.add({x,z,w:wide+.12,d:.22,rot:ry,bottom:Y+2.2,top:F.roof,tag:'oberlicht'});
    lighting.portals.add({id,rooms:['licht_flur4','licht_sekretariat'],normal,center:[x,Y+1.1,z],width:wide,height:2.2,hinge:1,
      opening:()=>1-Math.cos(Math.abs(d.pivot.rotation.y)),power:.27,range:4});
    return d;
  }
  function glass(x,z,w,h,y0,ry=0,material=M.flur3Glass,frame=M.flur4Wood,rows=null){
    b.push(x,Y+y0+h/2,z,ry);addWindow(b,M,{w,h,inset:.10,frame,glass:material,rows:rows??[{f:1,cols:Math.max(1,Math.round(w/1.05))}],sill:false});b.pop();
    C.add({x,z,w,d:.18,rot:ry,bottom:Y+y0,top:Y+y0+h,tag:'fenster'});
  }
  const turned=ry=>Math.abs(Math.sin(ry))>.5;
  function cabinet(id,x,z,ry,width,height,depth=.48,material=M.flur4Wood,name='Büroschrank'){
    b.push(x,Y,z,ry);addOfficeCabinet(b,M,{width,height,depth,material,doors:Math.max(2,Math.round(width/.5))});b.pop();
    C.add({x,z,w:width,d:depth+.045,rot:ry,bottom:Y,top:Y+height,tag:'schrank',id});anchor(id,'furniture',name);
    const hx=(turned(ry)?depth:width)/2,hz=(turned(ry)?width:depth)/2;map.furniture.push([x-hx,z-hz,x+hx,z+hz]);
  }

  // ---------------------------------------------------------------- Flur 4 (Treppenabsatz)
  // Bestehende Platte/Decke des oberen Absatzes bleiben allein in flur3.js.
  floor(9.2,F.north,F.east,F.south,M.flur3Floor);floor(F.west,F.north,9.2,-3.5,M.flur3Floor);floor(F.west,-.9,9.2,F.south,M.flur3Floor);
  ceiling(9.2,F.north,F.east,F.south,true);ceiling(F.west,-.9,9.2,F.south,true);
  // Links zwei Türen in den Bürogang (die hintere steht offen), Stirnwand eine Tür, rechts eine (flur4.JPG, Nutzerfoto 16.10.).
  wall([F.east,F.north],[F.east,F.south],[{u:6.65,w:1.14,y:0,h:2.25},{u:8.33,w:1.14,y:0,h:2.25}],true);
  wall([F.east,F.south],[F.west,F.south],[{u:.93,w:1.14,y:0,h:2.25}],true);
  wall([F.west,F.south],[F.west,-.897],[{u:1.15,w:1.14,y:0,h:2.25}],true);   // Ende 3 mm in der Flur-3-Wand
  door('flur4_tuer_buerogang_1','Tür zum Bürogang',F.east,.37,-Math.PI/2,{interactive:true,normal:[1,0]});
  door('flur4_tuer_buerogang_2','Tür zum Bürogang',F.east,2.05,-Math.PI/2,{interactive:true,normal:[1,0]});
  door('flur4_tuer_sued','Tür am Absatz · geschlossen',10.9,F.south,Math.PI);
  door('flur4_tuer_west','Bürotür · geschlossen',F.west,1.08,Math.PI/2);
  b.box(M.flur3Frame,1.0,.82,.09,8.95,Y+1.37,F.south-.05);b.box(M.flur4Column,.004,.70,.005,8.95,Y+1.37,F.south-.10);
  plane(M.fireSign,.12,.15,9.29,Y+1.53,F.south-.105,Math.PI);
  anchor('flur4_feuerloescher','decoration','Feuerlöschschrank');
  b.push(F.east-.035,Y+2.15,-3.4,-Math.PI/2);b.box(M.steelBlack,1.45,.82,.05);plane(M.kseWerbung,1.362,.76,0,0,.028);b.pop();
  anchor('flur4_monitor','decoration','Infobildschirm');
  // Der Lauf ins nächste Geschoss (1.jpg, 4.jpg) führt seit 17.10. nach Flur 5 (flur5.js).
  // Wand am oberen Lauf neben der Glasfront: Wappen, Erasmus-Tafel und Wegweiser (6.jpg, IMG_4761).
  plane(M.flur4Wappen,.42,.48,8.64,Y+2.32,S.front+.192);
  plane(M.flur4Erasmus,.50,.34,8.64,Y+1.62,S.front+.192);
  sign(M.flur4OgSign,7.45,S.front+.17,0,.62,.13,2.25);

  // ---------------------------------------------------------------- Sekretariat 228
  floor(S.wc,S.n,S.x1,S.front);floor(S.x0,S.n,S.wc,S.gs);floor(S.gx,S.front,S.x1,S.end);
  // Streifen unter der Frontwand bis zur Flur-4-Kante, damit unter den Scheiben keine Lücke bleibt.
  floor(S.wc,S.front,S.gx,F.north);
  // Rote Akustikplatten um die Säule (9.jpg, IMG_4770/4774), sonst weiße Raster.
  const column=[11.67,-9.87];
  ceiling(S.wc,S.n,S.x1,S.front,(x,z)=>Math.abs(x-column[0])<1.25&&Math.abs(z-column[1])<.95&&Math.hypot(x-column[0],z-column[1])>.3);
  ceiling(S.x0,S.n,S.wc,S.gs);ceiling(S.gx,S.front,S.x1,S.end);

  // Nordwand: Schrankgang mit 226, Sideboard, 227, Mosaikbild, Heizkörper, schmale Glastür; Oberlichtband.
  // Außenecken: Wände um die Wandstärke über die Ecke verlängert, sonst bleibt dort ein offener Spalt.
  wall([S.x0-.18,S.n],[S.x1+.18,S.n],[{u:3.04+.18,w:1.12,y:0,h:H},{u:8.79+.18,w:1.12,y:0,h:H},{u:13.21+.18,w:.98,y:0,h:H},
    {u:.3+.18,w:2.6,y:2.3,h:.65},{u:4.3+.18,w:4.3,y:2.3,h:.65},{u:10.1+.18,w:3.0,y:2.3,h:.65}]);
  for(const [x0,w]of[[.3,2.6],[4.3,4.3],[10.1,3.0]])glass(x0+w/2,S.n,w,.65,2.3,0,M.flur4Milk,M.flur3Frame);
  // Glastür hinter der Theke zu einem Nachbarraum (IMG_4770, Nutzerfoto); Raum nicht gebaut, daher Milchglas.
  door('flur4_glastuer','Glastür · geschlossen',13.7,S.n,0,{transom:true,wide:.86,leaf:M.flur4Milk});
  door('flur4_226','226 · Büro geschlossen',3.6,S.n,0,{transom:true});sign(M.flur4Room226,2.75,S.n,0);
  door('flur4_227','227 · Schulleiter geschlossen',9.35,S.n,0,{transom:true});sign(M.flur4Room227,8.55,S.n,0);
  // Westende des Schrankgangs: kleines Fenster über breitem Heizkörper.
  wall([S.x0,S.gs],[S.x0,S.n],[{u:.45,w:1.1,y:1.2,h:1.0}]);
  glass(S.x0,S.gs-1.0,1.1,1.0,1.2,Math.PI/2,M.flur4Milk,M.flur3Frame);
  b.push(S.x0+.01,Y,S.gs-1.0,Math.PI/2);addVerticalRadiator(b,M,{width:1.0,height:.95,y0:.12});b.pop();
  // Südseite des Schrankgangs = Rückwand des WC-Blocks; WC-Türen zeigen in den Empfang (links vom Büro*.JPG, 10.jpg).
  wall([S.wc,S.gs],[S.x0-.18,S.gs]);
  wall([S.wc,S.front],[S.wc,S.gs],[{u:.45,w:1.02,y:0,h:2.25},{u:2.45,w:1.02,y:0,h:2.25}]);
  for(const [i,z]of[-7.99,-9.99].entries())door('flur4_wc_'+i,'WC · geschlossen',S.wc,z,Math.PI/2,{wide:.9});
  for(const z of [-8.72,-9.26])sign(M.flur4WC,S.wc,z,Math.PI/2,.14,.16);
  // WC-Block innen nur als geschlossene Hülle (keine Fotos), damit durch Türfugen nichts Leeres zu sehen ist.
  // Darüber liegen Podest und Lauf nach oben von Flur 5: Hülle endet unter deren Boden/Stufen.
  surface(M.flur4Floor,5.6,S.gs+.18,S.wc-.18,S.front,Y);surface(M.ceilingPlain,7.0,S.gs+.18,S.wc-.18,S.front,F.roof,true);
  walls.boxMinMax(M.flur4Wall,5.42,Y,S.gs+.18,5.6,FLUR3.upper+1.8,S.front);
  // Glasfront zum Absatz: festes Feld, Tür mit E, gelbes Strukturglas (7.jpg, 8.jpg, IMG_4761).
  // Rechts davon ein Wandstück bis zum Bürogang, dessen Ecke der weiße Pfeiler mit Lichtschalter ist.
  wall([S.gx,S.front],[F.west,S.front],[{u:S.gx-12.25,w:3.25,y:0,h:H}]);
  const frontRows=[{f:.32,cols:1},{f:.44,cols:1},{f:.24,cols:1}];
  glass(9.625,S.front,1.25,H-.06,.03,Math.PI,M.flur3Glass,M.flur4Wood,frontRows);
  glass(11.87,S.front,.76,H-.06,.03,Math.PI,M.flur4Amber,M.flur4Red,frontRows);
  door('flur4_sekretariat','Sekretariat 228',10.87,S.front,Math.PI,{transom:true,mat:M.flur4Wood,interactive:true,wide:1.12,hinge:'left',glass:M.flur3Glass});
  lighting.portals.add({id:'flur4_sekretariat_glas',rooms:['licht_flur4','licht_sekretariat'],normal:[0,-1],center:[9.625,Y+1.5,S.front],width:1.25,height:2.9,transmission:.65,power:.2,range:3.5});
  plane(M.flur4ReceptionSign,.9,.56,9.68,Y+1.55,S.front+.115);
  // Die Front ist raumhoch geöffnet: Streifen zwischen Absatz- und Empfangsdecke schließen, sonst sieht man
  // seit Flur 5 in den oberen Gang (Raumsichtbarkeitsprüfung 17.10.).
  walls.boxMinMax(M.flur4Wall,8.6,F.roof+.01,S.front-.005,S.gx,F.roof+.7,F.north+.005);

  // Durchgehende Ostwand von Empfang und Bürogang: Hochschrank, Uhr, 229, Wandpfeiler, Tür neben dem
  // Kopierer, dann die Bürotüren des Gangs (IMG_4770–4772, 13.jpg, Sekretariat rechts langer gang2–4.JPG).
  wall([S.x1,S.n],[S.x1,S.end+.18],[{u:.2,w:2.0,y:2.3,h:.65},{u:2.19,w:1.12,y:0,h:H},{u:4.44,w:1.12,y:0,h:2.25},
    {u:8.14,w:1.12,y:0,h:H},{u:10.94,w:1.12,y:0,h:H},{u:13.94,w:1.12,y:0,h:H},{u:16.04,w:1.12,y:0,h:H}]);
  glass(S.x1,S.n+1.2,2.0,.65,2.3,-Math.PI/2,M.flur4Milk,M.flur3Frame);
  door('flur4_229','229 · Büro geschlossen',S.x1,-10.35,-Math.PI/2,{transom:true});sign(M.flur4Room229,S.x1,-11.05,-Math.PI/2);
  door('flur4_buero_kopierer','Büro · geschlossen',S.x1,-8.1,-Math.PI/2);
  for(const [i,z]of[-4.4,-1.6,1.4,3.5].entries())door('flur4_buero_ost_'+i,i===1?'231b · Technik geschlossen':'Büro · geschlossen',S.x1,z,-Math.PI/2,{transom:true});
  sign(M.flur4Room231b,S.x1,-.85,-Math.PI/2);
  plane(M.flur4Art[3],.55,.85,S.x1-.012,Y+1.55,-.2,-Math.PI/2);
  // Wandpfeiler zwischen 229 und der Tür am Kopierer sowie Vorsprünge im Gang (gang3).
  for(const [x0,z0,x1,z1]of[[S.x1-.3,-9.75,S.x1+.003,-9.3],[S.gx-.003,-4.42,S.gx+.2,-4.12],[S.x1-.2,-5.62,S.x1+.003,-5.32]]){walls.boxMinMax(M.flur4Wall,x0,Y,z0,x1,F.roof,z1);C.addBox(x0,z0,x1,z1,Y,F.roof,{tag:'wand'});}
  cabinet('sekretariat_schrank',S.x1-.26,-12.375,-Math.PI/2,1.35,2.08,.5);
  for(const z of [-12.85,-12.4,-11.95]){b.cylinder(M.chrome,.035,.08,.13,S.x1-.26,Y+2.15,z,12);b.cylinder(M.chrome,.08,.035,.18,S.x1-.26,Y+2.30,z,12);}
  b.box(M.aluminium,.04,.03,.42,S.x1-.3,Y+2.42,-12.15);b.box(M.aluminium,.32,.01,.06,S.x1-.3,Y+2.43,-12.05);
  const clock=createWallClock(M);clock.position.set(S.x1-.005,Y+1.95,-11.42);clock.rotation.y=-Math.PI/2;root.add(clock);

  // Empfangstheke: Bogen öffnet sich zur Glasfront/zum Schrankgang, Säule davor (9.jpg, IMG_4769–4774).
  const T={x:12.2,z:-10.4,r:-Math.PI/4,w:3.4};
  const local=(lx,lz)=>[T.x+lx*Math.cos(T.r)+lz*Math.sin(T.r),T.z-lx*Math.sin(T.r)+lz*Math.cos(T.r)];
  b.push(T.x,Y,T.z,T.r);addReceptionCounter(b,M,{width:T.w});b.pop();
  for(let i=0;i<6;i++){const lx=-T.w/2+(i+.5)*T.w/6,[x,z]=local(lx,-.17*lx*lx);C.add({x,z,w:.62,d:.83,rot:T.r+Math.atan(.34*lx),bottom:Y,top:Y+1.12,tag:'theke',id:'sekretariat_theke'});}
  anchor('sekretariat_theke','furniture','Empfangstheke');map.furniture.push([10.9,-12.2,14.0,-9.2]);
  b.cylinder(M.flur4Column,.105,.105,H,column[0],Y+H/2,column[1],24);C.addBox(column[0]-.11,column[1]-.11,column[0]+.11,column[1]+.11,Y,F.roof,{tag:'saeule'});
  {const [x,z]=local(-.2,-.85);const chair=createChair({...M,fabric:M.flur4Column});chair.position.set(x,Y,z);chair.rotation.y=T.r;root.add(chair);
    C.addBox(x-.25,z-.25,x+.25,z+.25,Y,Y+.86,{tag:'stuhl'});}
  plane(M.flur4Art[0],.95,1.25,11.9,Y+1.65,S.n+.012);
  b.push(12.85,Y,S.n,0);addVerticalRadiator(b,M,{width:.36,height:1.8,y0:.12});b.pop();
  // Abstandsstreifen aus boden.jpg.
  b.add(M.flur4Distance,new THREE.PlaneGeometry(.95,.085),matrixFrom(11.3,Y+.004,-7.8,-Math.PI/2,0,.9));
  b.add(M.flur4Orange,new THREE.PlaneGeometry(.9,.05),matrixFrom(12.1,Y+.004,-9.3,-Math.PI/2,0,.55));

  // Schrankgang: hohe Holzschränke links, Sideboard mit zwei Bildern rechts, Endtisch (gang links*.jpg).
  for(let i=0;i<4;i++)cabinet('flur4_akten_'+i,3.35+i*1.48,S.gs-.26,Math.PI,1.47,2.25,.5);
  b.box(M.panelGrey,.6,1.85,.6,2.25,Y+.925,S.gs-.31);C.addBox(1.95,S.gs-.61,2.55,S.gs,Y,Y+1.85,{tag:'schrank'});
  b.box(M.steelBlack,.45,.27,.35,7.6,Y+2.39,S.gs-.25);
  cabinet('flur4_sideboard',7.0,S.n+.24,0,2.6,.84,.46,M.flur4Wood,'Sideboard');
  plane(M.flur4Art[1],.58,.83,6.25,Y+1.55,S.n+.012);plane(M.flur4Art[2],.75,1.15,7.35,Y+1.42,S.n+.012);
  b.push(.75,Y,S.gs-.24);addSchoolTable(b,M,{width:.75,depth:.45});b.pop();C.addBox(.375,S.gs-.465,1.125,S.gs-.015,Y,Y+.76,{tag:'tisch'});
  b.box(M.steelBlack,.4,.3,.3,.75,Y+.2,S.gs-.25);

  // Bürogang: Westwand mit drei Türen und hellen Schränken, Tür mit Oberlicht am Ende.
  wall([S.x1,S.end],[S.gx-.18,S.end],[{u:.64,w:1.12,y:0,h:H}]);
  door('flur4_gangende','Tür am Gangende · geschlossen',S.x1-1.2,S.end,Math.PI,{transom:true});
  // Westseite ist die Flur-4-Wand mit den beiden Verbindungstüren; eigene Wand nur hinter dem Absatz.
  wall([S.gx,S.end],[S.gx,F.south]);
  b.push(S.x1-.37,Y,-6.6,-Math.PI/2);addCopier(b,M);b.pop();C.addBox(S.x1-.72,-6.96,S.x1,-6.24,Y,Y+1.12,{tag:'kopierer'});anchor('flur4_kopierer','furniture','Kopierer');
  cabinet('flur4_hell_tief',S.gx+.26,-6.4,Math.PI/2,1.0,.83,.5,M.flur4Cabinet,'Sideboard');
  cabinet('flur4_hell_hoch',S.gx+.26,-5.3,Math.PI/2,1.0,2.12,.5,M.flur4Cabinet);
  b.box(M.paper,.39,.27,.65,S.gx+.26,Y+.97,-6.4);
  // Zwei kleine Holzfiguren auf dem hohen Schrank, nur Silhouetten nach gang2.
  for(const z of [-5.55,-5.1]){const x=S.gx+.26;b.cylinder(M.flur4Wood,.045,.045,.16,x,Y+2.2,z,10);b.rod(M.flur4Wood,[x,Y+2.15,z],[x,Y+2.45,z],.018,8);b.rod(M.flur4Wood,[x,Y+2.3,z-.09],[x,Y+2.47,z+.11],.014,8);}
  // Arbeitsplatz am Gangende mit grünem Stuhl.
  const dx=S.gx+.32;
  b.push(dx,Y,3.75,Math.PI/2);addSchoolTable(b,M,{width:1.4,depth:.6});b.pop();C.add({x:dx,z:3.75,w:1.4,d:.6,rot:Math.PI/2,bottom:Y,top:Y+.78,tag:'tisch'});
  b.box(M.steelBlack,.06,.36,.5,dx-.17,Y+.98,3.75);b.box(M.steelBlack,.18,.02,.2,dx-.12,Y+.77,3.75);
  {const chair=createChair({...M,fabric:M.stoolGreen});chair.position.set(dx+.58,Y,3.7);chair.rotation.y=-Math.PI/2;root.add(chair);C.addBox(dx+.33,3.45,dx+.83,3.95,Y,Y+.86,{tag:'stuhl'});}
  plane(M.flur4Art[1],.5,.62,S.gx+.012,Y+1.6,3.75,Math.PI/2);

  // ---------------------------------------------------------------- Licht
  // Treppenabsatz und zusammenhängender Verwaltungsbereich; Grenze in der Mitte der Frontwand.
  function circuit(id,panel,positions,regions,extra=[]){
    const lights=[];
    for(const [x,z]of positions){const l=new THREE.PointLight(0xfff3db,17,7,2);l.position.set(x,F.roof-.34,z);root.add(l);lights.push(l);}
    for(const [x,z]of [...positions,...extra])addCeilingLight(fixtures,{...M,lightPanel:panel},x,F.roof-.025,z,{length:.59,width:.59});
    lighting.addCircuit(id,{lights,panels:[panel],regions,on:true});
  }
  const front=S.front+.09;
  circuit('licht_flur4',M.flur4Light,[[10.8,-4.8],[10.8,.65]],[[8.3,front,F.east+.09,2.98,Y-.08,F.roof+.08]]);
  circuit('licht_sekretariat',M.sekretariatLight,[[10.3,-8.4],[13.0,-11.4],[4.2,-12.1],[13.8,-5.6],[13.8,1.6]],
    [[S.wc-.09,S.n-.09,S.x1+.09,front,Y-.08,F.roof+.08],[S.x0-.09,S.n-.09,S.wc,S.gs+.09,Y-.08,F.roof+.08],
     [S.gx-.09,front,S.x1+.09,S.end+.09,Y-.08,F.roof+.08]],
    [[9.6,-12.0],[1.3,-12.1],[7.0,-12.1],[13.8,-2.2],[13.8,3.8],[11.0,-11.6]]);
  function lightSwitch(id,circuitId,x,z,ry){const sb=new PartBuilder();addSwitchPlate(sb,M,0,0,0);const s=sb.build({name:id});s.position.set(x,Y+1.05,z);s.rotation.y=ry;root.add(s);anchor(id,'switch','Licht',s);
    interactions.register(s,{id,type:'switch',label:()=>`${circuitId==='licht_flur4'?'Flur 4':'Sekretariat'}: Licht ${lighting.isOn(circuitId)?'ausschalten':'einschalten'}`,onInteract:()=>{lighting.toggle(circuitId);audio.click();}});}
  lightSwitch('lichtschalter_flur4','licht_flur4',F.east-.03,-5.8,-Math.PI/2);lightSwitch('lichtschalter_sekretariat','licht_sekretariat',12.42,S.front-.025,Math.PI);
  // Öffnung über beide Läufe (Ab- und Aufgang), damit auch der Blick über den oberen Lauf in den Schacht zählt.
  // Seit Flur 5 ist das Treppenauge darüber offen: Öffnung bis zur Absatzdecke (vorher 2,7 m).
  lighting.portals.add({id:'flur3_flur4_treppe',rooms:['licht_flur3','licht_flur4'],normal:[1,0],center:[8.3,Y+H/2,(F.north-.9)/2],width:F.north*-1-.9,height:H,power:.28,range:4});

  // ---------------------------------------------------------------- Karte, Bereiche
  map.areas.push({poly:[[8.3,F.north],[12.4,F.north],[12.4,2.8],[8.3,2.8]],fill:'rgba(174,113,143,.30)'},
    {poly:[[S.x0,S.n],[S.x1,S.n],[S.x1,S.end],[S.gx,S.end],[S.gx,S.front],[S.wc,S.front],[S.wc,S.gs],[S.x0,S.gs]],fill:'rgba(207,199,159,.35)'});
  map.labels.push({text:'Flur 4',x:10.4,z:-2.8},{text:'228 · Sekretariat',x:11.8,z:-11.2});
  root.add(walls.build({name:'flur4_waende'}),b.build({name:'flur4_ausstattung'}),fixtures.build({name:'flur4_leuchten',castShadow:false}));
  root.traverse(o=>{if(o.isMesh&&o.material===M.flur4Wall)metricBoxUV(o.geometry,.65);if(o.isMesh&&o.material===M.flur4Perforated)metricBoxUV(o.geometry,.08);});
  const inside=(p,x0,z0,x1,z1)=>p.x>=x0&&p.x<=x1&&p.z>=z0&&p.z<=z1;
  return {id:'flur_4',name:'Flur 4 · Sekretariat',root,mapFloor:1,bounds:{minX:S.x0-.18,maxX:S.x1+.18,minZ:S.n-.18,maxZ:S.end+.18,minY:Y,maxY:F.roof+.13},update(dt){updates.forEach(t=>t.update(dt));},
    areaName(p){if(p.y<Y-.12||p.y>F.roof)return null;
      if(inside(p,F.west,F.north,F.east,F.south))return 'Flur 4 · Treppenabsatz';
      if(inside(p,S.wc,S.n,S.x1,S.front))return 'Sekretariat 228 · Empfang';
      if(inside(p,S.x0,S.n,S.wc,S.gs))return 'Sekretariat · Schrankgang';
      if(inside(p,S.gx,S.front,S.x1,S.end))return 'Sekretariat · Bürogang';return null;}};
}
