// Schätzmaße nach 23 Außenreferenzen, siehe PLANUNG 25. Innenraumachsen bleiben fest.
export const HOF={west:-26,east:19.8,wallZ:12.6,y:-.02,tree:{x:-3.2,z:8.5},
  bed:{x0:-27,x1:-6.55,z0:2.1,z1:8.4,y:-1.65},wingZ:1.15,roof:11.2};
// Die nicht rechteckige Hof-Fläche darf Lounge/Flure nicht als Außenbereich erkennen.
export const HOF_REGIONS=[
 [-5.2,-.125,-.4,1.15,-.3,14],[-6.55,1.15,-.4,9.4,-.3,14],
 [-27,8.4,-.4,12.6,-2,14],[-.4,9.4,19.8,12.6,-2,14],[-26,1.15,-5.2,2.1,-.3,14],
 // Westende nach neu/1–3.jpg: Beet mit Rampe zum Haus, Weg am Haus vorbei und Biegung.
 [-27,2.1,-6.55,8.4,-2,14],[-33.5,9.4,-26,15.5,-2,14],
];
export function inHof(p){return HOF_REGIONS.some(([x0,z0,x1,z1,y0,y1])=>p.x>=x0&&p.x<=x1&&p.z>=z0&&p.z<=z1&&p.y>=y0&&p.y<y1);}
