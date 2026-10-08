import {Navigate,useLocation} from 'react-router-dom';
import {useAuth} from '../context/auth-context';
import {guestReturn} from '../lib/guest-editor';
import type {ReactNode} from 'react';
export function GuestResumeGate({children}:{children:ReactNode}){
 const {session}=useAuth(),location=useLocation(),target=guestReturn();
 if(session.user&&target&&location.pathname!=='/login'&&location.pathname+location.search!==target)return <Navigate to={target} replace/>;
 return children;
}
