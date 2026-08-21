# PD — team engagement, 19 August 2026

_Two things: the follow-up questions put to the five who reviewed, and the message
opening the review to everyone else. Kept because the answers are the raw material
for the next design decisions, and because the method matters as much as the answers._

---

## 1. Why the follow-up was needed

The first round came back unanimous and general. Agreement with a principle is cheap;
only Maleeha's reply was grounded in actual work. So the follow-up asks each person
about **one specific instance**, not their opinion. Opinions come out general.
Memories come out specific.

**How to ask:**

- One to one, never in a group. In a group the second person agrees with the first.
- One specific instance: "the last one", "name one".
- Three questions maximum per person. Five gets tired answers.
- Say plainly that **"I don't know" and "it doesn't happen" are useful answers**, or
  people invent something to be helpful.
- Ask, then be quiet. The detail arrives in the pause.

---

## 2. The one question for all five

> In the last three months, name one piece of work we did that we had already done
> before. What was it, and why did it get repeated?

**If nobody can name one, the duplication problem is smaller than assumed** — and
that changes how much the Combination Bank is worth. This question is a test of the
premise, not a rhetorical device.

---

## 3. The questions, by person

### Fahim — Plant Manager
1. Think of the last thing R&D handed you to make at plant scale. What did you learn
   on the plant that nobody knew in the lab?
2. When a trial batch runs on your plant, what does it actually cost you — which line
   stops, for how long, and what doesn't get made that day?
3. Before you agree to run a trial batch, what do you need to know that you usually
   aren't told?

_Why: he is the only one who can price a sample in real terms. "Unnecessary effort
and expense on samples" is the whole premise, and nobody has costed it._

### Himmayat — R&D Manager
1. Take one reaction-based product you are working on now. From first sample to
   knowing it is stable — how many weeks, and what do you measure on which days?
2. Think of a long trial that failed. Did it fail because of the chemistry, or because
   someone stopped waiting?
3. If a trial takes 12 weeks, what should the system show in week 3 so nobody thinks
   it is stuck?

_Why: Q1 gives the real reading schedule that `PENDING-DECISIONS.md` B6 needs. Q2
separates a chemistry problem from a management problem._

### Maleeha
1. Which idea were you working on last week? What exactly did you want to look up?
2. Where did you go instead, and what did you end up doing — dropped it, ran it
   anyway, or asked someone?
3. If one person could have answered you in a single line, what would that line have
   said?

_Why: **her answers are worth more than the rest combined.** She hit the real gap on
real work. Reconstructing that one failed lookup in detail tells us what the search
must actually do — and Q3 gives the shape of the answer the system has to produce._

### Abdullah Naveed — Lab and R&D Officer
1. Of the samples you made last month, how many did you know the purpose of before you
   started? For the ones you didn't, who asked you and what did you ask back?
2. When a sample fails, where does that result go today? Who reads it?
3. What would make you push back and say a sample should not be made yet?

_Why: he is where the rule bites. Q3 is the real test — the procedure only works if a
lab officer feels able to refuse._

### Masab — Lab In-charge
1. Name one trial this year where the conclusion was never written down. What did we
   lose?
2. When R&D, QC, Plant and Agronomy read the same result differently, how does it get
   settled today?
3. Show me the shortest written conclusion you would still find useful. An example
   from a real trial, not a description.

_Why: Q3 sets the minimum bar for the written conclusion. Set it by his example rather
than by design, and it will be short enough that people actually write it._

### Ask everyone, at the end
> Which real question should we run first, as a test of the procedure itself?

_That is `PENDING-DECISIONS.md` B5, and letting them choose it costs nothing._

---

## 4. The message opening this to everyone else

Sent after the follow-ups. Two deliberate choices: the thanks names **what each
person actually contributed**, because specific thanks reads as real and general
thanks reads as management noise; and it **asks for disagreement outright**, because
five replies with no criticism usually means agreement with a good idea rather than
with a procedure anyone has had to follow.

> To the team,
>
> Thank you to Fahim, Himmayat, Maleeha, Abdullah and Masab for replying on the new PD
> procedure. None of you just said yes. Each of you added something we did not have:
>
> **Fahim** — the gaps will show up while we use it, not before we build it.
> **Himmayat** — keep the objective clear on every trial, and give reaction-based
> products the time they actually need to prove stability.
> **Maleeha** — we have no place to look up what we already learned about a problem.
> She ran into this last week on real ideas.
> **Abdullah** — a clear question before the sample, a written result after it.
> **Masab** — every trial ends with a written conclusion, so R&D, QC, Plant and
> Agronomy are reading the same record.
>
> Two of these have already changed the design. Himmayat's point about long trials, and
> Maleeha's about looking things up. That is what a review is for.
>
> Now I want to hear from everyone else, and I want the disagreement as much as the
> agreement.
>
> If you think a part of this will not work on a normal busy day, say so. If you think
> it adds paperwork without adding value, say that. It is far cheaper to fix now than
> after it is built.
>
> Three things, from anyone willing:
>
> 1. One part of this you think will not survive a busy week.
> 2. One piece of work you think we repeated because nobody knew it had already been done.
> 3. Which real question should we run first, as a test of the procedure itself.
>
> Short answers are fine. "I don't know" is fine. There is no wrong answer at this stage.
>
> Tahir

---

## 5. Where the answers go

- Fahim Q2 (cost of a trial batch) → the missing number behind the whole premise.
- Himmayat Q1 (weeks and reading days) → `PENDING-DECISIONS.md` **B6**.
- Maleeha Q1–Q3 → `combination-bank/RULES.md` §9 (search) and **B8** (problem dossier).
- Masab Q3 (shortest useful conclusion) → the minimum content of a Run's written result.
- Everyone's last answer → **B5**, which question the pilot runs.

**Record the answers verbatim.** Paraphrase loses the specific detail, which is the
only reason the follow-up exists.

_Name spellings are Tahir's own from the review thread; two looked shortened
(`Himmayt`, `Abdullah naved`) and Maleeha's role is not yet recorded._
