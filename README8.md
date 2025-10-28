# Sprint 8: Privacy and Pathfinding

### Task B: Data Collection and Advertising
#### Which kinds of ads you do not want to include on your web app, along with a justification for each

- Personalized/behavioral ads based on cross‑site tracking or fingerprinting  
  Justification: Avoid invasive profiling, respect user privacy, and reduce regulatory risk; prefer contextual ads that don’t rely on third‑party cookies or covert identifiers.

- Precise location‑targeted ads (GPS or fine‑grained geolocation)  
  Justification: Our app already uses location data; combining it with ad targeting increases safety risks (stalking/doxxing) and may violate user expectations of privacy.

- Remarketing/retargeting ads that follow users across sites  
  Justification: Creepy user experience, lowers trust, and increases dependency on cross‑site tracking; opt for session‑bound, contextual relevance instead.

- Sensitive category ads: political/issue advocacy, religious content, health/medical and mental health, financial services (payday loans/crypto/speculative trading), gambling/betting, adult content, alcohol/recreational drugs  
  Justification: Ethical concerns, potential harm, and audience suitability (students/minors); reduces legal/compliance exposure and preserves brand neutrality.

- Deceptive or manipulative ads (get‑rich‑quick, miracle cures, fake “tech support,” misleading downloads, dark‑pattern signups)  
  Justification: Protect users from fraud and coercion; maintain integrity and trust in the platform.

- Intrusive ad formats: pop‑ups, auto‑play audio/video, large interstitials, sticky overlays blocking content  
  Justification: Harms accessibility, performance, and Core Web Vitals; degrades primary app functionality.

- Ads that collect PII inside the ad unit (embedded lead forms requesting phone, address, SSN, etc.)  
  Justification: Practice data minimization; reduce security and compliance risks from third‑party PII collection.

- Political microtargeting and demographic‑profiling ads  
  Justification: Preserve platform neutrality; prevent potential discrimination and reduce regulatory scrutiny.

- Data‑broker/“people search”/background‑check ads  
  Justification: Avoid facilitating doxxing or harassment; protect user safety.

- Ads requiring third‑party cookies once deprecated or that bypass consent (e.g., non‑consensual tracking)  
  Justification: Align with privacy expectations and evolving browser policies; rely on non‑personalized, contextual ads.

- Ads targeting minors or encouraging age‑restricted behaviors  
  Justification: Comply with youth‑protection norms (e.g., COPPA where applicable); protect vulnerable users.

#### How much of the information you identified would be useful and responsible to provide to an ad service?
The app collects and uses only limited, non-sensitive data to support responsible advertising. User-provided data includes basic session information such as a temporary account ID (without any email or personally identifiable information), the city or region entered for trip planning, and selected date ranges. Non-sensitive preferences like interface theme (e.g., dark mode) and bandwidth-saving mode may also be stored. Data inferred from in-app actions includes which pages or features are used (such as the Planner, Map, or Reviews), filters toggled (for example, “outdoor” or “family-friendly”), and the number of pins saved. The app may also record coarse map context at the city level, engagement signals like time on page or interactions, and whether users view, add, or edit reviews—but never the review text itself.

Only minimal, contextual, and non-sensitive data is shared through responsible opt-in mechanisms. This may include the current page topic (such as “travel planning” or “map usage”), a coarse location at the city or region level (never GPS or precise coordinates), and non-sensitive interest tags derived from user actions (like “hiking,” “museums,” or “budget-friendly”). Device type, language, and general time of day are shared for accessibility and ad frequency capping. A short-lived, session-scoped ad identifier that rotates frequently ensures no cross-site tracking or fingerprinting. Aggregated session statistics—such as total pins saved—may be shared without exposing raw logs or detailed trip data.

Certain categories of data are explicitly excluded from sharing. These include all personally identifiable information (such as names or emails), exact coordinates, specific itineraries, raw review text, and any user-generated content. Sensitive topics—such as health, politics, religion, finance, adult content, gambling, or substance-related information—are never shared. Identifiers that could enable cross-site tracking, like third-party cookies or persistent device fingerprints, are also prohibited.

Strong controls and safeguards are in place to protect user privacy. Users who decline data sharing receive only non-personalized or strictly contextual ads. Data sharing enforces city-level k-anonymity, ensuring that information is shared only when at least 1,000 users are active in the region. Data is retained for no more than seven days, and only aggregated summaries are exported—no raw event streams. A transparent consent interface provides clear explanations of data use, per-category toggles, and simple opt-out options, ensuring users maintain full control over their privacy.



### Task C: Technical Design for Stakeholder Needs
#### Part 1: “Data Consumer” Stakeholders
Alice Lee works at the city’s Department of Public Health and leads the Active Mobility Initiative, which promotes walking, biking, and other forms of low-emission personal transportation. Her department wants to use your app’s aggregated, anonymized travel data to better understand how residents and visitors move through different neighborhoods. By analyzing patterns such as common route clusters, travel durations, and areas with high pedestrian or cycling activity, the agency hopes to identify neighborhoods underserved by safe pathways or “mobility deserts” where new bike lanes, crosswalks, or public benches could encourage active transit. The department also plans to use this data to estimate transportation-related carbon emissions, measure the environmental impact of local travel, and evaluate the effectiveness of sustainability initiatives such as car-free zones or public bike-share programs. By demonstrating how infrastructure improvements can simultaneously reduce emissions, improve air quality, and promote healthier lifestyles, Alice’s team hopes their findings will inform future citywide climate and public health policies.

#### Part 2: “Data Producer” Stakeholder Concerns

**Zalison Eng**, a 34-year-old single father, uses the app to plan his daily commute. His main concerns about sharing travel pin data center around the safety and privacy of his family. Because his routes likely include stops at his children’s school or daycare, he worries that data sharing could expose his children’s routines or locations to strangers. He is also concerned that publicly visible commuting times might signal when his home is unoccupied, making it vulnerable to burglary. In addition, if his employer were able to access or infer details from his travel history, it might raise questions about his punctuality or personal errands, creating uncomfortable workplace dynamics.

**Sanant Araf**, a 15-year-old high school student who runs a dog-walking business, faces distinct privacy and safety challenges. Since her daily routes involve walking through neighborhoods at predictable times, she is at risk of being tracked by strangers if her location data were shared. She also worries about protecting her clients’ privacy—travel pins could inadvertently reveal their home addresses, violating their trust and possibly putting them at risk. As a minor, Sanant is especially vulnerable to online or physical harassment, so even anonymized location data could present serious personal safety risks if patterns are discernible.

**Nim Telson**, a 20-year-old college junior, is planning a trip to Puerto Rico but has told his parents that he will be attending a college-sponsored meditation retreat. His concern is that shared travel data might reveal the truth about his destination, compromising his privacy. He also fears that friends, university staff, or others with access to his data might misinterpret his actions or judge him for being deceptive. Beyond personal exposure, Nim worries that travel-related data could be used by companies for targeted advertising or by insurers to adjust his rates based on his travel habits.

**Dathy Letter**, a 57-year-old corporate employee who also organizes political activities outside of work, is particularly cautious about how shared travel data could expose her extracurricular engagements. If her app history shows frequent visits to protest sites or civic centers, her employer might view this unfavorably, potentially threatening her job security. She also fears broader implications such as government surveillance or being profiled by data brokers based on her political activities. Dathy values keeping her professional and personal lives separate and would find any public linkage between her workplace and activism deeply concerning.

**Koren Baas**, a 61-year-old managing multiple health conditions, uses the app to keep track of medical appointments. His primary concerns revolve around medical privacy and discrimination. Shared travel pins that reveal regular visits to hospitals or specialized clinics could expose sensitive health information. Such data might be used by insurance companies to infer chronic illness, leading to higher premiums or reduced coverage. Koren also worries about the social stigma associated with certain types of medical treatment—if his travel patterns were made public, others might draw unfair conclusions about his health or personal circumstances.

#### Part 3: Technical Solutions
**Data Fields: Inclusion and Exclusion**
The shared dataset will include only the information necessary for traffic analysis and urban planning while excluding personally identifiable or highly precise details. The included fields will be: (1) *generalized origin and destination areas* represented at the city block or grid level (e.g., a 500-meter radius or Census block centroid) rather than exact coordinates, which supports understanding travel flow patterns without exposing specific addresses; (2) *time windows* expressed as hourly or 15-minute intervals (e.g., “07:00–08:00” instead of “07:43”) to allow peak-hour analysis while preventing the reconstruction of precise routines; (3) *mode of transportation* (walking, biking, driving, or public transit) to support low-carbon and mobility studies; (4) *trip distance and duration* for evaluating commute efficiency and infrastructure accessibility; and (5) *anonymized, session-level user IDs* that cannot be linked to long-term individual histories.

Excluded fields will include exact GPS coordinates and full route trajectories, all personal identifiers such as names, emails, phone numbers, or device IDs, and any persistent identifiers that allow long-term tracking across sessions. This approach maintains the minimum data granularity required for useful analysis while removing elements that could reveal a specific individual’s identity or sensitive locations like homes, schools, or workplaces.


**Privacy Preservation and Data Transformations**
To safeguard user privacy, several technical transformations will be applied before data sharing. Spatial generalization will be implemented through grid-based encoding (e.g., reducing GeoHash precision to level 6) or location perturbation (adding random noise within ±100–200 meters). Sensitive points of interest—such as residences, schools, or medical facilities—will be automatically masked and replaced with the nearest public landmark or neighborhood centroid. Temporal aggregation will convert exact timestamps into coarser hourly or 15-minute windows to obscure exact travel times and reduce the ability to infer daily routines.

Further, differential privacy techniques will introduce small amounts of statistical noise to aggregated outputs (such as heatmaps or flow distributions), ensuring that the inclusion or exclusion of any single user has an insignificant effect on the overall analysis. A k-anonymity constraint (with k ≥ 50) will ensure that no published spatial unit represents fewer than fifty users, preventing isolation of individual travel patterns. Finally, all approved third-party analysts will access the data through a secure sandbox environment, which restricts them from downloading or exporting raw records—only aggregated, privacy-preserving summaries can be generated within the controlled system.


**Risks and Limitations**
Despite these safeguards, some risks remain. From the user perspective, re-identification attacks are still possible if an adversary cross-references the shared data with external information sources such as social media posts or public event records. There is also an inherent trade-off between privacy and utility: excessive spatial or temporal generalization can reduce the precision and usefulness of analyses, while insufficient generalization can increase re-identification risk.

For data users, privacy mechanisms such as differential privacy and spatial masking may slightly reduce accuracy, particularly for fine-grained models of traffic congestion or neighborhood mobility. Moreover, the secure sandbox access model limits data manipulation flexibility and may require additional infrastructure, analyst training, and computational resources. Nonetheless, this design provides a balanced compromise—meeting institutional data needs for transportation and planning insights while meaningfully addressing individual users’ safety and privacy concerns.


### Supplemental Challenge (S_DIST/1340)
#### Question 1
#####
#####
#####
#####
#### Question 2
#### Question 3
#####
#####
#####

### Design Choices

#### Errors/Bugs:
#### Tests:
#### How To…

#### Team members and contributions (include cs logins):
Yanmi Yu(yyu111): Task B, Task C
Rui Zhou(rzhou52): Task A

#### Collaborators (cslogins of anyone you worked with on this project or generative AI):
Claude 3.7/ChatGPT4: explianing code functionality when starting, idea inspriation, generate a set of example code, syntax check, debug logic, comments, gramma. 


#### Total estimated time it took to complete project:

#### Link to GitHub Repo:
https://github.com/cs0320-f25/pins-and-pathfinding-rzhou52-yyu111


