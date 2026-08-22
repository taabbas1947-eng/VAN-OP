# Replies to Majid and Fahim

*Draft for Tahir. Short on purpose. Send as messages, not as a document.*

---

## To Majid

> Majid, thank you for this. You were right, and you were right without having
> seen the fault list I had already written, which is the strongest evidence I
> had that the problem was real and that people were hitting it daily. It moved
> up the queue because you raised it.
>
> It is built. There is now one Correct button, on the record itself, and the old
> scattered ways of editing are closed. You pick a reason from a short list,
> write a sentence saying what happened, and the change goes to Reports,
> Corrections with your name, your role, and the value before and after. Nothing
> is deleted. If an entry should never have existed, you reverse it and it stays
> on the record with a line through it.
>
> Two things I want to be straight with you about.
>
> Some corrections will refuse. A packing lot that a shipment already refers to
> cannot be reversed. An approved certificate and a passed inspection cannot be
> edited at all. Those get superseded or withdrawn instead, and both keep
> printing with a stamp on them. Of the 113 passed inspections in the system, 93
> cannot be withdrawn because the material has already shipped. That refusal is
> the normal case, not a bug. The rule underneath it is that once the paper or
> the bag has left the building, the record is not allowed to start disagreeing
> with it.
>
> And filling in a blank is not treated as a correction. Typing a number into an
> empty box does not ask you for a reason. Changing a number that was already
> there does. I separated those two deliberately, because otherwise the first
> thing this system would have done is make somebody write 136 explanations for
> filling in 136 empty fields, and everyone would have found a way around it
> inside a week.
>
> One thing I need from you. Use it for a couple of weeks and tell me whether the
> reason list actually covers what you hit. The codes are keying error, wrong
> record, quantity miscount, price wrong, recorded late, customer amended,
> duplicate, and other. If you find yourself picking "other" more than
> occasionally, the list is wrong and I want to fix it rather than have people
> type into a box that nobody can count later.
>
> Tahir

---

## To Fahim

> Fahim, all three of the things you raised are done. Two of them were bigger
> than you reported.
>
> The gate pass. You were right that it was not in your actions. When I went
> looking, the whole truck process after Ship was missing from everyone's
> worklist, not just yours. Start loading, issue gate pass, release, approve the
> delivery challan, confirm delivery. Not one of those raised an item. So when I
> had been saying people were not responding to the Action Center, for half the
> shipment process there was nothing there to respond to. That was the system,
> not the people. All five now appear, and a loaded truck waiting on release
> escalates to me after a day.
>
> It was worse for you than for anyone else, because the Shipments screen belongs
> to Supply Chain. You had view access by default and had to go hunting on
> somebody else's screen for a button that nothing told you was waiting. You had
> two kinds of action item in the whole system before this.
>
> The phone. The app was pushing the page sideways on seven screens out of
> twelve, and you had to scroll most of a screen before you saw a single task.
> Both fixed. Three tasks are now visible on the first screen where before there
> were none.
>
> Which brings me to a question for you. What I have built is the desktop app
> packed sensibly onto a phone. What I have not built is something actually
> designed for a phone, where the Action Center is the home screen, approve and
> reject sit under one thumb, and you scan a batch number with the camera instead
> of typing it. That is a much bigger piece of work and I do not want to start it
> on a guess. Which of the two were you asking for?
>
> One more thing, which came out of fixing your bug. Release never checked
> whether the truck had passed its pre-shipment inspection. It checked your role,
> the stage and the gate pass, and nothing else. It does now. If release refuses,
> it means QA has not passed that truck. I checked before turning it on: all 135
> shipments on the system carry a passing inspection and nothing is sitting in
> loading, so this blocks nothing that exists today. It blocks the next one that
> tries.
>
> Tahir
