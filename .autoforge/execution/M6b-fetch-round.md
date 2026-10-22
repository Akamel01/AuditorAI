# M6b — raw fetch-round log (curated evidence)

Container-local log of the loop-6 live fetch round, kept verbatim so the per-skip
evidence ships with the branch (the raw file `.autoforge/tmp/m6b-fetch.log` is
ephemeral and gitignored).

Command: `npx tsx scripts/harvest-track-a.ts fetch --live --max=12`
(robots.txt, the 10 s crawl delay on `open.alberta.ca` and 1 request/second per host
are enforced by the CLI).

Every `hash-already-present` line is a document whose bytes WERE downloaded and were
then discarded: the known-hash gate runs after the response arrives
(`scripts/harvest-track-a.ts:547-567`). Such a document is never re-ingested and never
enters the intake manifest.

```
[ab-open] 1 candidate url(s), cap 3
  skip (hash-already-present): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/2f0b905f-2c5c-4257-a91b-8272cb605242/download/neahdappendixc.pdf
[ab-open] fetched 0, skipped hash-already-present=1
[ab-publications] 2 candidate url(s), cap 2
  skip (hash-already-present): https://open.alberta.ca/dataset/c9e2f226-9518-45d2-806c-8558195d60c6/resource/fac2c710-26cc-47bb-a184-38d4ea2683e9/download/2004-rsa-guidelines-final-report.pdf
  skip (hash-already-present): https://open.alberta.ca/dataset/eb777feb-e6c8-4c45-b93b-62bed8f5c5a4/resource/1591d634-3ad1-45d8-8a65-e78ce6d7b232/download/2004-rsa-implementation-plan-final-report.pdf
[ab-publications] fetched 0, skipped hash-already-present=2
[ab-publications-listing] 12 candidate url(s), cap 12
  skip (not RSA): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/212db9fe-810f-4af2-a7d7-552039ef0fd0/download/neahd12579-entire-pdf.pdf
  skip (not RSA): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/39128b0a-0a7a-4e48-8c33-839a34261729/download/neahdappendixa.pdf
  skip (not RSA): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/0332cc27-4313-49ac-a843-044ca50784c1/download/neahdappendixb.pdf
  skip (hash-already-present): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/2f0b905f-2c5c-4257-a91b-8272cb605242/download/neahdappendixc.pdf
  skip (not RSA): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/6ed3f865-3b09-42ad-b475-3ad95c414c32/download/neahdappendixe.pdf
  skip (not RSA): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/eba945ff-2e96-4327-9df6-923c4864f8b0/download/neahdappendixf.pdf
  skip (not RSA): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/f997e417-eacd-4f24-af7c-85265762cf9a/download/neahdappendixg.pdf
  skip (not RSA): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/065ff563-5b7e-47a0-b83a-782e9d3a2b89/download/neahdappendixh.pdf
Warning: UnknownErrorException: Ensure that the `standardFontDataUrl` API parameter is provided.
  skip (not RSA): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/6324cd57-603a-4f4a-9031-51fe5e19c03b/download/neahdappendixeappendices.pdf
  skip (not RSA): https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/8c7b9c55-9236-40a0-9fdf-9665a3858147/download/neahdbridgesummary.pdf
  skip (hash-already-present): https://open.alberta.ca/dataset/c9e2f226-9518-45d2-806c-8558195d60c6/resource/fac2c710-26cc-47bb-a184-38d4ea2683e9/download/2004-rsa-guidelines-final-report.pdf
  skip (hash-already-present): https://open.alberta.ca/dataset/eb777feb-e6c8-4c45-b93b-62bed8f5c5a4/resource/1591d634-3ad1-45d8-8a65-e78ce6d7b232/download/2004-rsa-implementation-plan-final-report.pdf
[ab-publications-listing] fetched 0, skipped not RSA=9, hash-already-present=3
[bc-moti] 38 candidate url(s), cap 6
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2017/t02-17_watermarked.pdf
Warning: TT: undefined function: 32
Warning: TT: undefined function: 32
Warning: TT: undefined function: 32
Warning: TT: undefined function: 32
Warning: TT: undefined function: 32
Warning: TT: undefined function: 32
Warning: TT: undefined function: 32
Warning: TT: undefined function: 32
Warning: TT: undefined function: 32
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2023/t02-23.pdf
Warning: TT: undefined function: 21
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2026/t02-26.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2025/t02-25.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2022/t02-22.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2018/t02-18-watermarked.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2005/t02-05.pdf
  skip (hash-already-present): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/1994/t02-94_watermarked.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2000/t02-00.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2001/t02-01.pdf
  skip (hash-already-present): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2004/t02-04c.pdf
  skip (hash-already-present): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2004/t02-04b.pdf
  skip (hash-already-present): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2004/t02-04a.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/1990/t02-90_watermarked.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/1991/t02-91_watermarked.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/1993/t02-93.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2003/t02-03.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2006/t02-06.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/1996/t02-96.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/1995/t02-95.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/1997/t02-97.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2007/t02-07.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2002/t02-02.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2012/t02-12.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2013/t02-13.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2009/t02-09.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2014/t02-14.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2010/t02-10.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2011/t02-11_watermarked.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2015/t02-15.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2016/t02-16.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/1998/t02-98_watermarked.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2019/t02-19.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2024/t02-24.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2020/t02-20.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/1999/t02-99.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/natural-resource-use/resource-roads/t02-forest-road-survey-and-design.pdf
  skip (not RSA): https://www2.gov.bc.ca/assets/gov/driving-and-transportation/transportation-infrastructure/engineering-standards-and-guidelines/technical-circulars/2021/t02-21.pdf
[bc-moti] fetched 0, skipped not RSA=34, hash-already-present=4
[qc-montreal-open] 0 candidate url(s), cap 4
[qc-montreal-open] fetched 0, skipped none
[qc-mtl-transports] 2 candidate url(s), cap 2
Warning: TT: undefined function: 21
  skip (not RSA): https://cdn-contenu.quebec.ca/cdn-contenu/adm/min/transports/transports/aide_financiere/reseaux-routiers-locaux-municipaux/voirie-locale/plan-securite-routiere/guide-elab-PSRMM.pdf
  skip (robots): https://www.bv.transports.gouv.qc.ca/mono/1117153.pdf (robots.txt fetch failed: fetch failed)
[qc-mtl-transports] fetched 0, skipped not RSA=1, robots (robots.txt fetch failed: fetch failed)=1
[qc-montreal-city] 2 candidate url(s), cap 2
  skip (not RSA): https://ville.montreal.qc.ca/pls/portal/docs/PAGE/COMMISSIONS_PERM_V2_FR/MEDIA/DOCUMENTS/REF_MEM-SAAQ_201702.PDF
  skip (http 401): https://ville.montreal.qc.ca/pls/portal/docs/PAGE/PRT_VDM_FR/MEDIA/DOCUMENTS/MEMOIRE_VILLE_MONTR%C3%89AL_PL-48.PDF
[qc-montreal-city] fetched 0, skipped not RSA=1, http 401=1
[toronto-legdocs] 4 candidate url(s), cap 4
Warning: TT: undefined function: 32
  skip (not RSA): https://www.toronto.ca/legdocs/mmis/2023/ie/bgrd/backgroundfile-239909.pdf
  skip (not RSA): https://www.toronto.ca/legdocs/mmis/2024/ie/bgrd/backgroundfile-250583.pdf
Warning: TT: undefined function: 32
  skip (not RSA): https://www.toronto.ca/legdocs/mmis/2019/ie/bgrd/backgroundfile-134964.pdf
  skip (not RSA): https://www.toronto.ca/wp-content/uploads/2026/04/95d9-VZAR2025Finala.pdf
[toronto-legdocs] fetched 0, skipped not RSA=4
[unb-transport] 1 candidate url(s), cap 2
  skip (hash-already-present): https://www.unb.ca/research/transportation-group/_assets/documents/rsa-guidelines.pdf
[unb-transport] fetched 0, skipped hash-already-present=1
```
