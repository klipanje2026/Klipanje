export const handoffDefinitions=[
 ['collectionHandoffImpact','handoff-impact','Impact', '100px Archivo Black',4,736/920],
 ['collectionHandoffImpactRefined','handoff-impact-refined','Impact Refined', '100px Archivo Black',4,736/920],
 ['collectionHandoffCutout','handoff-cutout','Cutout', '100px Archivo Black',4,736/920],
 ['collectionHandoffPrism','handoff-prism','Prism', '100px Archivo Black',4,736/920],
 ['collectionHandoffPressure','handoff-pressure','Pressure', '100px Archivo Black',4,736/920],
 ['collectionHandoffOrbit','handoff-orbit','Orbit', '100px Archivo Black',4,736/920],
 ['collectionHandoffFault','handoff-fault','Fault', '100px Archivo Black',4,736/920],
 ['collectionHandoffDuet','handoff-duet','Duet', '100px Archivo Black',4,736/920],
 ['collectionHandoffAxis','handoff-axis','Axis', '100px Archivo Black',4,736/920],
 ['collectionHandoffSignature','handoff-signature','Signature', '100px Archivo Black',4,736/920],
 ['collectionHandoffMomentum','handoff-momentum','Momentum', '100px Archivo Black',4,736/920],
 ['collectionHandoffLedger','handoff-ledger','Ledger', '100px Archivo Black',4,736/920],
 ['collectionHandoffSignal','handoff-signal','Signal', '100px Archivo Black',4,736/920],
] as const;
export const handoffStyleKeys=new Set<string>(handoffDefinitions.map(d=>d[0]));
