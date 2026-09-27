# Portfolio & positioning

*How to turn three systems you already built — a NIM agent, ai-precommit-guardian, and a JFrog-on-ROSA migration — into public write-ups that do the arguing for you before you ever get on a call.*

## The problem this step solves

You have done the work. You have run inference containers in production, written a tool that stops bad commits, and moved an artifact repository onto managed OpenShift without taking the build system down. None of that is visible.

A résumé bullet says *"Migrated JFrog Artifactory to ROSA."* A hiring manager reads that and learns almost nothing: how big, how hard, what broke, what you decided and why. A 1,800-word write-up with a before/after diagram and three real numbers answers all of it in eight minutes, and it does so while you are asleep.

That is the entire premise of this step. You are not building a portfolio to prove you can code. You are building **evidence of judgment** — the thing that separates a senior platform engineer from a competent one, and the thing that is almost impossible to demonstrate in a 45-minute interview.

> Interviews test whether you can think under pressure. Write-ups prove you have already thought. Only one of those can be prepared in advance.

---

## What "best-in-class" actually means here

Most engineering blog posts fail in one of five predictable ways. Know them so you can avoid them.

| Failure mode | What it looks like | Fix |
|---|---|---|
| **Tutorial cosplay** | "Step 1: install the Helm chart. Step 2: apply this YAML." Reproduces the docs | Write about *decisions*, not *procedures*. The docs already exist and are better maintained than your post |
| **Vague triumphalism** | "Dramatically improved performance and reliability" | One number with a measurement method beats ten adjectives |
| **The heroic narrative** | Everything went perfectly, you were brilliant throughout | Include the thing that broke. It is the most credible paragraph you will write |
| **Context-free deep dive** | Paragraph three is a stack trace; the reader never learned what the system does | Two-paragraph context section, always, before any detail |
| **Diagram as decoration** | A box-and-arrow picture that restates the prose | Every diagram must convey something prose cannot — usually topology, sequencing, or a before/after delta |

The inverse is a simple test: **would a staff engineer at a company you want to work for learn something from this?** If the answer is no, you have written documentation, not a case study.

---

## The template

Use the same structure for all three write-ups. Consistency is itself a signal — it reads as a body of work rather than three unrelated posts. Adjust section lengths, not section order.

```
# <Concrete outcome, not the technology name>
   Bad:  "Using NVIDIA NIM"
   Good: "Cutting cold-start latency 6x by moving our agent onto NIM containers"

## Context            (150-250 words)
   What the system is. Who uses it. Scale in real units.
   What was true before this project. Why it stopped being acceptable.

## The problem        (200-300 words)
   Sharp statement of the constraint. What made it hard rather than tedious.
   The failed or rejected first attempt, if there was one.

## Options considered (250-400 words)  <- the highest-value section
   2-4 real alternatives. For each: why it was plausible, why it lost.
   Include the option a reader would expect you to pick, and say why you didn't.

## What we built      (400-600 words)
   Architecture. One diagram, referenced explicitly in the prose.
   The two or three non-obvious implementation details worth stealing.

## Results            (150-250 words)
   3-5 metrics, each with a measurement method and a time window.
   Include at least one number that did not improve.

## What I'd do differently (100-200 words)
   Specific and technical. Not "start earlier" or "communicate more."

## Appendix / repo link (optional)
   Config snippets, the repo, the demo video.
```

Target **1,500–2,200 words**. Below 1,200 you cannot establish enough context to be credible; above 3,000 you are writing a book chapter that nobody will finish. The "Options considered" section is the one hiring managers actually read closely — it is the only part that cannot be faked by someone who did not do the work.

### Title lines that work

The title is doing 80% of the distribution work. Compare:

- **Weak:** "My experience with ROSA" — sounds like a diary entry
- **Weak:** "JFrog Artifactory on Red Hat OpenShift Service on AWS" — sounds like a vendor datasheet
- **Strong:** "Migrating a 4TB Artifactory instance to ROSA with 12 minutes of downtime" — a specific claim a reader can verify by reading

Put the number in the title where you have one. Numbers are what make a technical title scan as credible rather than promotional.

---

## Picking metrics that survive scrutiny

The fastest way to lose a technical reader is an unverifiable claim. The fix is mechanical: for every number you publish, state **what was measured, how, and over what window**.

| Weak | Strong |
|---|---|
| "Much faster startup" | "p95 cold start fell from 47s to 8s, measured over 500 pod starts in the week after cutover" |
| "Reduced costs significantly" | "Monthly storage spend went from $2,180 to $1,340 after moving binaries to S3-backed filestore; measured from the AWS Cost Explorer line item, 30 days pre/post" |
| "Near-zero downtime" | "12 minutes of write unavailability during the final sync; reads served from the replica throughout" |
| "Developers love it" | "Adoption went from 3 to 41 repositories in 6 weeks; 11% of blocked commits were true positives on manual review" |

You do not need a monitoring stack to do this. Three legitimate sources of honest numbers, in descending order of preference:

1. **Instrumented measurement** — Prometheus, CloudWatch, Cost Explorer, CI job durations. Screenshot-able, defensible.
2. **Deliberate before/after sampling** — run the same benchmark twenty times before and after. Report the median and the spread, not the best run.
3. **Counted facts** — repositories onboarded, artifacts migrated, lines of policy, alerts fired, PRs blocked. Unglamorous but unfalsifiable, and often more persuasive than a latency chart.

Two rules that buy disproportionate credibility:

- **Publish a number that got worse.** "Image size grew 340MB because we baked the model into the container to avoid a cold pull" tells the reader you understand trade-offs. A post where every arrow points the right way reads as marketing.
- **Never publish a number you cannot reproduce on request.** Someone will ask in the interview. If your answer is "I don't remember how I measured that," the whole post is retroactively discounted.

If you genuinely have no metrics — say for `ai-precommit-guardian`, which may be young — then generate them. Run the tool across 500 historical commits from a public repository, count how many it flags, hand-review a sample for precision. That is one afternoon of work and it converts an opinion piece into an evidence piece.

---

## Architecture diagrams that earn their place

A diagram is worth including when it shows something **prose is bad at**: topology, concurrency, sequencing, or a before/after delta. It is clutter when it merely re-lists what the paragraph above it already said.

**Rules of thumb:**

- **One diagram per major idea, maximum three per post.** Readers skim diagrams; a wall of them gets skipped entirely.
- **Cap it at 12–15 boxes.** Past that, split into two diagrams at different zoom levels rather than shrinking the font.
- **Label the edges, not just the nodes.** "gRPC, mTLS, 2s timeout" on an arrow carries more information than three more boxes.
- **Before/after should be one image, side by side or stacked** — the comparison is the point, and forcing the reader to scroll between two images destroys it.
- **Annotate the interesting part.** A callout reading "this is the piece that broke" or "new in this migration" directs attention better than color alone.
- **Never use color as the only encoding.** Roughly 8% of male readers cannot distinguish red from green. Use shape, position, or a label as well.
- **Legible at phone width.** A meaningful share of your readers arrive from a LinkedIn link on a phone. Test it.

Use the **C4 model's** zoom levels as a discipline even if you do not adopt its notation: pick one level (system context, container, or component) per diagram and stay there. Mixing a load balancer, a Kubernetes namespace, and a Python class in the same picture is the single most common way engineering diagrams become unreadable.

**Tooling:** hand-drawn-style tools like Excalidraw suit narrative blog posts — the informal look signals "explanatory sketch," which is what you want, and the `.excalidraw` file is editable later. draw.io is the better pick for a formal before/after infrastructure diagram with real AWS/Kubernetes icon sets, and it exports clean SVG. Mermaid is right for sequence diagrams that live in a repo README and should diff sensibly in Git. Pick one primary tool and use it across all three posts; visual consistency is a large part of what makes a portfolio look deliberate.

---

## Worked outline: JFrog-on-ROSA

Here is the template applied concretely, so you can see the shape before you write it.

**Title:** *Migrating a 4TB Artifactory instance to ROSA with 12 minutes of write downtime*

**Context (~200 words).** What Artifactory was doing for the organization — the number of repositories, artifact types (Docker, Maven, npm), daily pull volume, and how many CI pipelines depended on it. Then the "before": self-managed on EC2 or an on-prem cluster, and specifically what hurt. Patch burden? Storage on EBS growing past comfort? No HA? Upgrade windows nobody wanted to own? Name the pain in operational terms, not emotional ones.

**The problem (~250 words).** Artifactory is a stateful system that every build in the company blocks on. That means the migration constraint is not "can it run on ROSA" — it obviously can — but "how do we move 4TB of binaries and a live database without stopping the build system for a day." State the specific hard parts: filestore migration strategy, database cutover, DNS/ingress switchover, and the fact that a rollback after go-live is expensive because artifacts written post-cutover only exist in the new system.

**Options considered (~350 words).** This is the section that proves seniority. At minimum, cover:
- *Self-managed OpenShift on EC2* — full control, but you own etcd, upgrades, and the control plane; quantify that in on-call hours if you can.
- *Plain EKS + Artifactory Helm chart* — cheaper, but if the organization's operating model is OpenShift (Routes, SCCs, OperatorHub, existing RBAC conventions), you pay a permanent translation tax.
- *JFrog Cloud (SaaS)* — the option readers will ask about, so address it head-on. Data residency? Egress cost? Network path to on-prem builds? Contract economics?
- *ROSA* — and why it won: managed control plane with a joint Red Hat/AWS support path, native AWS integration for storage and IAM, and an operating model the platform team already knew.

Be explicit that this was a trade, not a coronation. ROSA has a control-plane cost and less configuration latitude than self-managed. Saying so is what makes the rest believable.

**What we built (~500 words).** The before/after diagram lives here. Cover the storage decision (S3-backed filestore vs. persistent volumes and why), the database (RDS vs. in-cluster PostgreSQL), how ingress works via Routes and where TLS terminates, node placement and machine pools, and the backup/restore path. Then the two or three genuinely non-obvious details — the ones a reader would hit on their own attempt. Something like: the filestore sync ran in two passes, a long online rsync followed by a short delta sync inside the downtime window; or the SCC adjustment Artifactory needed to run non-root; or the surprise in how Docker registry paths resolved behind an OpenShift Route.

**Results (~200 words).** Downtime measured against a specific event window. Storage cost delta with the measurement source. Pull latency p50/p95 before and after, same benchmark both times. Number of repositories and total artifacts moved. And the honest cost: the ROSA control-plane fee is a new line item that did not exist before — publish it.

**What I'd do differently (~150 words).** Something technical and specific. "I would have built the artifact-integrity verification script before the migration instead of during it — we spent the first two hours after cutover manually spot-checking checksums that a 60-line script could have covered exhaustively."

The same skeleton fits the other two. For the **NIM agent**, the "options considered" section is where you compare NIM containers against self-hosted vLLM, against a hosted API, and against Triton directly — and where you say what NIM's packaging actually bought you versus what it cost in flexibility. For **ai-precommit-guardian**, the interesting sections are the false-positive rate (developers uninstall a noisy hook within a week — say what your threshold was and how you tuned toward it) and the latency budget, because a pre-commit hook that adds four seconds to every commit is dead on arrival regardless of how good its judgment is.

---

## Where to publish

| Platform | Best for | Trade-off |
|---|---|---|
| **GitHub Pages (own domain)** | The canonical home of all three posts | Some setup; you own the URL forever and the analytics are yours |
| **dev.to** | Distribution to a working-engineer audience | Lower prestige; use canonical tags pointing back to your site |
| **Medium** | Broad reach, some publications have real audiences | Paywall and interstitials annoy engineers; weakest choice of the three |
| **Company engineering blog** | Highest credibility if available | You may not own it, and it may not follow you when you leave |
| **Long-form LinkedIn article** | Nothing. Post the *summary* on LinkedIn, host the article elsewhere | Poor formatting for code and diagrams, no canonical URL you control |

The right pattern is **own the canonical, syndicate everywhere else.** Publish on your own GitHub Pages site with a real domain, then cross-post to dev.to using its canonical URL field so search engines credit your site. Never let a third-party platform be the only home of your best work.

Three posts is exactly the right number for a first pass: enough to demonstrate range (inference infrastructure, developer tooling, platform migration), few enough to finish. A site with three excellent posts beats one with twelve mediocre ones, every time.

---

## Positioning: making the work findable

Writing it is 60% of the work. The rest is making sure the right people encounter it.

**Per post, publish a LinkedIn summary — not a link dump.** The platform suppresses posts with external links, and a bare link converts poorly anyway. Write 150–200 words in the post body that stand on their own: the problem, the surprising thing you learned, one number. Put the link in the first comment or at the end. Ask one genuine question to invite replies. Post Tuesday–Thursday morning in your target market's timezone.

**Rewrite your résumé bullets from the posts, not the other way round.** A write-up forces you to find the numbers; the bullet is then a one-line compression of it. Structure: *action + system + scale + measured result.*

- Before: "Migrated JFrog Artifactory to OpenShift."
- After: "Migrated a 4TB, 200-repository Artifactory instance to ROSA with 12 minutes of write downtime, cutting monthly storage spend 38% and eliminating control-plane patch ownership."

**Rewrite your LinkedIn headline to the destination, not the origin.** "DevOps Engineer" describes where you have been. "Platform Engineer — AI/ML infrastructure, Kubernetes, GPU workloads" describes where you are going, and it is what recruiters search. Add a Featured section linking all three posts.

**Make each repo's README a landing page.** Anyone who reaches `ai-precommit-guardian` from your post lands on the README first. It needs: what it does in one sentence, a 20-second install-and-run, an animated GIF or screenshot of real output, and a link back to the write-up. A repo with a bad README destroys the credibility the post just built.

**Record a short demo where the tool is the point.** For `ai-precommit-guardian`, a 5–8 minute screen recording of a real commit being blocked, the reasoning being shown, and the developer resolving it is worth more than 1,000 words of description. Script it, keep it under eight minutes, show a failure case, and embed it in the write-up.

**Then close the loop.** Send the post to two or three specific people who would find it genuinely useful — a former colleague who runs the same stack, someone whose work you cited. Targeted sharing outperforms broadcast by an enormous margin, and it is how posts reach hiring managers rather than the algorithm.

> Publish the first one before the second one is perfect. Three shipped write-ups at 85% beat one polished draft that never leaves your laptop, and the second post is always better than the first because you learned something writing it.

---

## Where to go next

- **[Google Technical Writing Courses](https://developers.google.com/tech-writing)** — free, short, and the fastest available fix for the sentence-level habits that make engineering prose hard to read. Work through Technical Writing One before you draft post number one.
- **[The C4 model](https://c4model.com/)** — the discipline of picking one zoom level per diagram and staying there. Adopt the thinking even if you do not adopt the notation.
- **[Postmortem Culture: Learning from Failure (Google SRE Book)](https://sre.google/sre-book/postmortem-culture/)** — the canonical model for writing about systems honestly. The blameless, evidence-first posture it describes is exactly the tone that makes a technical case study credible.
