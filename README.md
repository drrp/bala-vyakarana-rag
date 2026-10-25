# Telugu Traditional Grammar — Retrieval-Augmented Study Tool

A study tool for **Telugu traditional grammar** (బాలవ్యాకరణము and ప్రౌఢవ్యాకరణము),
built so that every answer is **drawn from the commentaries themselves** rather than
paraphrased by a language model.

To our knowledge this is the first retrieval-augmented system built over Telugu
traditional grammar and its ఘంటాపథము commentaries.

**Author:** Rambhatla Parvatheeswara Sarma — rpsarma9247@gmail.com
**Live:** https://lms.auchithyam.com/

---

## What it does

You ask a question in Telugu. The system retrieves the relevant passages from the
corpus, and answers with:

- the **sutra**, quoted **in full**, with its printed reference
- the **commentary** on it, from each book that discusses it
- **examples**, and a **రూపసాధన** derivation of every example given

Answers are organised by **book**, each source getting its own section in a fixed
order, so it is always clear which authority says what.

---

## The method

The parts we believe are new, and the parts that were difficult:

### 1. Retrieval over commentary, not just sutras

Most grammar tools index the sutras. This one indexes the **commentaries** as well —
the బాలవ్యాకరణ ఘంటాపథము and ప్రౌఢవ్యాకరణ ఘంటాపథము — because that is where the
explanations, the worked derivations and the variant readings actually live.

### 2. Correcting sutra boundaries against the printed page

The OCR of the printed books broke many sutras across their line breaks: the first
line became the sutra and the remainder was filed as an "example". The result was a
sutra that stopped mid-clause, and an examples field opening with a verb.

We established the true boundary **from the printed page itself** — the raw OCR was
correct, it was the extraction that had split it. The test we settled on:

> Take the following sentence as part of the sutra **only when it completes the
> sutra** — ending in a terminal verb such as *నగు / అగు / ప్రయోగింపఁబడుడు* — and
> never when it is a word list or a commentary sentence.

That qualifier matters: the **సంజ్ఞా** sutras carry no final full stop, so a naive
"take everything up to the full stop" rule would have wrongly absorbed the
**వర్ణమాల** and commentary into seven of them.

### 3. Making the machine quote its authority, not invent one

A language model reliably quotes a sutra's **wording** but not its **number**. Four
successive prompt rules failed to fix this. The solution was not instruction but
**lookup**: a coverage scorer matches the quoted text against the sutra table and
resolves the number from the text, rather than trusting the number the model wrote.

Bare sutra numbers inherit the last-named pariccheda, as the commentary itself does —
*"సమాస 25చే … 17చే"* means సమాస 25 and సమాస 17, not సంధి 17.

### 4. Derivation extraction

Worked derivations are **extracted from the commentary** and injected into the prompt
as authoritative chains, anchored on the commentary's own *ప్రక్రియ* marker. The
authority for a derivation is the commentary's own worked chain, not a rule the model
reconstructs.

### 5. Multi-source answers

Each source gets its own section, in a fixed order, with its own citation
abbreviation — so a పదకోశము definition is never presented as a rule, and no book is
padded from another.

### 6. A Telugu input method

The composer transliterates Roman input to Telugu using the **Lekhini** scheme,
implemented from that scheme's own published table so that rare letters
(ఋ ౠ ఌ ౡ ౘ ౙ) are all reachable.

---

## Corpus

| text | role |
|---|---|
| బాలవ్యాకరణము + బాలవ్యాకరణ ఘంటాపథము | primary grammar and commentary |
| ప్రౌఢవ్యాకరణము + ప్రౌఢవ్యాకరణ ఘంటాపథము | primary grammar and commentary |
| వ్యాకరణ పదకోశము (బొడ్డుపల్లి పురుషోత్తము) | lexicon |
| స్ఫూర్తిశ్రీ బాల ప్రౌఢ వ్యాకరణ సర్వస్వం | supplementary |
| శబ్దరత్నాకరము (1912) | grammatical features |

### Provenance note

The **underlying works are long out of copyright**. However, where a **modern edited
edition** was used as the source, its editorial additions may carry their own
copyright, separate from the base text. Anyone reusing the corpus should establish
which edition each text was drawn from before redistributing it. The OCR of a
public-domain book is a mechanical reproduction and is not separately protected.

**The licence below covers the software. It does not assert any right over the
underlying texts, which are the work of their original authors.**

---

## Licence

Copyright 2025 Rambhatla Parvatheeswara Sarma.

Licensed under the **Apache License, Version 2.0** — see [LICENSE](LICENSE).
You may use, modify and redistribute this software, including commercially,
provided you preserve the copyright notice and attribution.

---

## Citing this work

See [CITATION.cff](CITATION.cff), or use the **"Cite this repository"** button on
GitHub. If you build on the corpus corrections or the retrieval method described
above, please cite this repository.
