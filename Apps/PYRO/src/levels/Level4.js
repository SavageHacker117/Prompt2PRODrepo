// Level4.js – Dungeon theme
export default {
  name: 'Level 04', theme:'dungeon', required: 3,
  bricks: [
    {x:-2.0,y:1.0,sx:1.4,sy:2.0,sz:1.2},
    {x: 2.0,y:1.0,sx:1.4,sy:2.0,sz:1.2},
    {x: 0.0,y:0.6,sx:0.8,sy:1.2,sz:1.2},
  ],
  torches: [
    {x:-3.2,y:1.6},{x:0.0,y:2.2},{x:3.2,y:1.6}
  ],
  powerups:[ {type:'extraShot', x:0,y:3.4} ]
}
