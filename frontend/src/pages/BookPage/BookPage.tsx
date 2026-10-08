import { BookingForm } from '../../components/BookingForm/BookingForm';
import { InnerShell } from '../../components/InnerShell/InnerShell';


export default function BookPage() {
  return <InnerShell><section className="booking-page shell"><div className="booking-intro"><p className="eyebrow"><span />Free 30-minute project call</p><h1>Let’s find the smallest useful way to move your project forward.</h1><p>Choose a time that works for you. We’ll discuss the goal, the current bottleneck and whether outsourcing, custom software or automation is the right next step.</p><ul><li>No sales pressure</li><li>Practical first recommendations</li><li>Clear next step after the call</li></ul></div><BookingForm locale="en" /></section></InnerShell>;
}
