// Stable portrait indices: append new people without changing existing project demos.
export const portraits = [
 {src:'/images/home/creators.png',size:'300% auto',position:'left center',panel:0},
 {src:'/images/portraits/man-podcast.png',size:'cover',position:'center',panel:null},
 {src:'/images/portraits/woman-outdoors-v2.png',size:'cover',position:'center',panel:null},
 {src:'/images/home/creators.png',size:'300% auto',position:'center center',panel:1},
 {src:'/images/portraits/woman-home-v2.png',size:'cover',position:'center',panel:null},
 {src:'/images/portraits/man-daylight.png',size:'cover',position:'center',panel:null},
 {src:'/images/portraits/woman-studio-v2.png',size:'cover',position:'center',panel:null},
 {src:'/images/portraits/woman-creative.png',size:'cover',position:'center',panel:null},
 {src:'/images/portraits/man-creative.png',size:'cover',position:'center',panel:null},
];
export function portraitStyle(index:number){
 const image=portraits[((index%portraits.length)+portraits.length)%portraits.length];
 return {backgroundImage:`url("${image.src}")`,backgroundSize:image.size,backgroundPosition:image.position,backgroundRepeat:'no-repeat'};
}
