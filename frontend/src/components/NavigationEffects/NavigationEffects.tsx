import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {localTools} from '../../lib/local-tools';

const pages:Record<string,[string,string]>={
 '/':['Početna','home'],
 '/projekti':['Projekti','projects'],
 '/skripte':['Skripte i naracije','scripts'],
 '/fotografije':['Generacije elemenata','generations'],
 '/definisanje-kadrova':['Definisanje kadrova','frames'],
 '/galerija':['Galerija','gallery'],
 '/zvukovi':['Zvukovi','sound'],
 '/obrada-materijala':['Obrada materijala','tools'],
 '/preeditor':['Preeditor','preeditor'],
 '/videa':['Video editor','editor'],
 '/video-editor':['Video editor','editor'],
 '/titlovi':['Video editor','editor'],
 '/prilagodi-video':['Prilagodi video','video-tools'],
 '/video-alati':['Prilagodi video','video-tools'],
 '/prilagodi-zvuk':['Prilagodi zvuk','audio-tools'],
 '/administracija':['Administracija','tools'],
 '/login':['Prijava','home'],
 '/promjena-lozinke':['Promjena lozinke','tools'],
};
export function NavigationEffects() {
 const {pathname,hash}=useLocation();
 useEffect(()=>{
  const [name,icon]=pages[pathname]||[localTools.find(tool=>tool.path===pathname)?.label||'Klipanje','tools'];
  document.title=name+' — Klipanje';
  let link=document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}
  link.type='image/svg+xml';link.href='/favicons/'+icon+'.svg';
 },[pathname]);
 useEffect(()=>{
  if(hash)document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  else window.scrollTo(0,0);
 },[pathname,hash]);
 return null;
}
