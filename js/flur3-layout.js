// Gemeinsame Anschlussmaße, damit Foyer und OG dieselbe Treppe/Lichtgrenze benutzen.
// Aus Fotos geschätzt, kein vermessenes Geschoss (PLANUNG 24).
export const FLUR3 = { west:-5.2, east:5.6, north:-6.85, south:-0.25,
  nicheX:-2.6, nicheZ:-12.2, y:3.62, roof:6.72,
  stairEnd:8.3, stairNorth:-6.85, stairMiddle:-3.56, stairSouth:-0.9,
  lower:1.53, upper:5.55, upperEnd:9.2, stairRoof:8.65, steps:13 };

// Die Unterseite des schrägen Rücklaufs trennt UG/Foyer und Flur 3.
export function returnStairRegions(upper){
  const f=FLUR3, result=[];
  for(let i=0;i<f.steps;i++){
    const a=f.east+(f.stairEnd-f.east)*i/f.steps,b=f.east+(f.stairEnd-f.east)*(i+1)/f.steps;
    const boundary=f.y+(f.lower-f.y)*(i+.5)/f.steps-.10;
    result.push([a,f.stairNorth,b,-3.62,upper?boundary:-10,upper?f.stairRoof:boundary]);
  }
  return result;
}
