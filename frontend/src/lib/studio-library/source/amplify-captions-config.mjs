export const AmplifySamples=[
 'Kasno je, grad još diše, a mi tražimo malu avanturu i pretvaramo svaki trenutak u priču.',
 'Jedna pjesma, malo sunca i taj osjećaj da danas sve može drugačije, uz ljude koje volim.'
];
const ampPalettes=values=>values.map(([name,a,b,dark='#18212a',ink='#fff8e9'])=>({name,a,b,dark,ink}));
export const AmplifyStyles={
 flex:{name:'FLEXLINE',fonts:['barlow','text','italic'],sizes:[89,91,100],align:[-1,0,1],gap:16,texture:'satin',palettes:ampPalettes([['Coral & lime','#ff927f','#d9f575','#172029'],['Electric lilac','#ba9aff','#82e4e1'],['Pink & cobalt','#ffadd9','#9fc8ff'],['Honey & mint','#f3ce75','#8fdbc6']])},
 riso:{name:'RISO WAVE',fonts:['italic','oswald','block'],sizes:[92,107,89],align:[0,-1,1],gap:15,texture:'halftone',palettes:ampPalettes([['Vermilion & sky','#ff976b','#81d9ee','#23272e'],['Cherry & butter','#ff9ba8','#f6db7f'],['Lavender & leaf','#c6a3fa','#b1e49a'],['Sea & peach','#79dfc8','#ffc19b']])},
 fold:{name:'FOLD SIGNAL',fonts:['slash','italic','block'],sizes:[91,99,88],align:[-1,1,0],gap:18,texture:'paper',palettes:ampPalettes([['Apricot & ink','#ffc078','#bca8f8','#22222d'],['Lime & ocean','#d7ef8b','#87d3e5'],['Rose & vanilla','#f1a8cf','#f8d894'],['Periwinkle & mint','#b5b6fc','#a4e1bd']])},
 glass:{name:'GLASS PULSE',fonts:['oswald','saira','text'],sizes:[85,99,78],align:[0,0,-1],gap:21,texture:'frost',palettes:ampPalettes([['Arctic & berry','#99e8f2','#f8a0d4','#17232d'],['Violet & amber','#c4b0ff','#ffcc8e'],['Mint & iris','#a3eed3','#bcb9ff'],['Peach & glacier','#ffb99b','#a5e0f0']])},
 drive:{name:'OUTLINE DRIVE',fonts:['tall','italic','block'],sizes:[105,95,89],align:[0,1,-1],gap:16,texture:'stripe',palettes:ampPalettes([['Lemon & electric','#e9f68a','#99cafa','#1d2431'],['Salmon & aqua','#ffb193','#87e4d4'],['Orchid & cream','#e9a6ed','#f5db96'],['Ice & rose','#a6deee','#f4aac2']])},
 punch:{name:'PUNCHCUT',fonts:['barlow','italic','barlow'],sizes:[88,109,93],align:[-1,1,0],gap:16,texture:'paper',palettes:ampPalettes([['Orange & acid','#ff9c66','#d4f27e'],['Violet & peach','#c7adff','#ffc096'],['Mint & pink','#9ce6c4','#ffacce'],['Blue & lemon','#a1cefa','#e6ed87']])},
 relay:{name:'PAPER RELAY',fonts:['text','block','barlow'],sizes:[69,96,97],align:[0,-1,1],gap:14,texture:'paper',palettes:ampPalettes([['Coral & lilac','#ffae97','#b9b0f4','#24232d'],['Butter & blue','#f3da88','#a4cbf1'],['Pistachio & cream','#c4d893','#f5d6ac'],['Pink & mint','#f4b3d7','#a9d9c5']])},
 double:{name:'DOUBLE TAKE',fonts:['oswald','saira','oswald'],sizes:[87,103,94],align:[0,0,0],gap:15,texture:'halftone',palettes:ampPalettes([['Aqua & coral','#77e5df','#ff947e','#18212b'],['Lilac & lime','#c2a2ff','#d6ed73'],['Rose & ice','#ff9bc5','#94d7ff'],['Apricot & sea','#ffb272','#a1e7cc']])},
 trace:{name:'TRACE MODE',fonts:['saira','oswald','saira'],sizes:[80,98,86],align:[-1,0,1],gap:19,texture:'grid',palettes:ampPalettes([['Acid circuit','#dbf977','#a9b9ff','#172327'],['Ice circuit','#96dafa','#b7e1c5'],['Orange circuit','#ffac72','#c1abff'],['Pink circuit','#f99acf','#88e4dc']])},
 wild:{name:'WILD NOTE',fonts:['hand','block','italic'],sizes:[109,94,87],align:[0,1,-1],gap:8,texture:'paint',palettes:ampPalettes([['Ink & tangerine','#ffb273','#c7ed99','#222426'],['Berry & yellow','#ffafd4','#eed983'],['Mint & chalk','#a5e2c7','#dbc2f1'],['Lavender & sky','#c8adfa','#a9d7ed']])}
};

AmplifyStyles.wild.palettes.push(...ampPalettes([["Cobalt / citrus","#175cff","#f4df20","#122137","#fffbee"],["Scarlet / ivory","#f13d4f","#f9eacb","#321d2a","#fff9f2"],["Emerald / aqua","#18b47c","#4ee5ea","#10372d","#effff5"],["Violet / tangerine","#934cff","#ff982d","#291d3c","#fff3ea"]]));
