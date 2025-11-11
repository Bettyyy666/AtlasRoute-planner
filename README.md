[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/hFtJy6BL)

# Sprint 9: Privacy and Pathfinding 2

### Task C: Preserving Privacy (AI use: allowed for code only)

$Implementation$

#### 1.Hashed User Identifier:

Getting inspired by another course (blockchain and cyptocurrency), I used SHA256 hash to replace the orignial `UserId`. When the requested data include the user's personal identifier, we just use the deterministic, non-reversible `userhash` to replace that value.By doing this, we could efficiently prevent malicious identity re-identifacation.

#### 2.Controlled noise

I used controlled noise to protect users' data privacy. By adding small Gaussian noise. My user's coordinates will be applied approximate 50 meter std dev noise. By doing this, we could make user's precise location unpredicable while maintaining the research value of the data.

#### 3.Date Truncation

We want to keep the user's exact date of trips as privacy. By using `toYearMonth()` function, we convert the date data from exact timestamp format to `"YYYY-MM"` format, reducing the tracability.

#### 4.Activity Date Anonymization

Replace the real activity data (e.g., "11/07") with relative labels("day1", "day2"). By doing that, we could preserve the time sequence and trips structure while hiding the actual date to reduce the possibility of daliy pattern prediction.

$Reflection:$

In implementing coordiante data privacy controls, I choose to use noise injection rather than aggregation.

The First reason is the returned data structure for my datarequest endpoint is fetched and process on a per-user basis, which means the data could reflect only individual's travel pattern. And since at most of the situations, users typically visit a limited number of locations that are clustered. As a result, aggregation method would be too much useful for improving user's anoymity.

And We decided to use controlled noise to perserve spatial structure of data. After adding the noise to coordinates, these coordinates are still recongizable, and easy to integrate with visualization and map interaction purposes. We think this method provides a perfect balance between privacy the the usability of the data.

One concern I identified during implementation is that noise injection can occasionally distort edge-case locations — especially those near coastlines or water boundaries(I mean SF in our sprint). When the noise shifts a coordinate that originally on land in the ocean or other unreachable area, This becomes problematic when combined with features like pathfinding or route generation, since these “off-map” points can lead to invalid paths or cause runtime errors.We think we could implement a potential boudary check to prevent that kind of problem.

### For everyone: What does an “A” grade look like? (AI use: none)

whu34:In Previous sprints completing the red-highlighed functionality feature was never my only goal. As an enigneer, I kept thinking how real users would perceive our webiste if it were truly deployed, or If I have to design another product like this, how would that feature looks like. For example, When users add trips, how could they best manage those trips and adding/updating/deleting pins from those trips afterwards.

However, this mindset also caused me to overcommit cause I didn't want to just check boxes for functionality; I wanted to build something that actually meaningful and made sense to my users. Such that, I often spent more time than others doing my sprint.

This Sprint changed how I think about that balance. Without a fixed rubric, I had to define for myself what "a good feature" and "a good test suites" should look like. For example, I focused on making my data reques endpoint both lofical and visually polished. But I soon realized that this didn't improve the actual users' experience. Most of users don't really need a nicely formated display,what they want is just accessible raw JSON data to analyze and work on later and my design was actually unintentionally limiting their freedom of using data.

After this, I understand that `A-level` quality is not just about balancing functionality and aesthetics.Thinking from the user’s perspective matters more than spending extra hours perfecting implementation details. Also, As a enigneer, time is valuable, when you start doing something, you need to think about the possibility of success and whether those designs are explainable and user-centered - being able to justify why a choice makes the product more successful. If we could do that, I totally believe that would be 100% a A-level quality of work.

rzhou52: For me, an "A" grade means building something that actually works well and that I'm proud to show off. It's not just about checking boxes—it's about delivering real value in a way that shows good judgment and care. First, the feature needs to work completely, not just in the perfect scenario. If something goes wrong, the system should handle it smoothly instead of crashing or confusing the user. I need to think through the edge cases and make sure my code doesn't break when things get messy. Second, my code should be clean and easy to understand. If I come back to it in a month, or if someone else needs to work with it, they shouldn't have to spend hours figuring out what I was thinking. Good naming, clear structure, and sensible design choices matter. Testing is also key. I don't need to test every single line, but the main features should have automated tests so I know they work and will keep working as I make changes. This gives me confidence that I'm not accidentally breaking things. Most importantly, I've learned that being user-friendly separates good work from just functional work. Does my feature make sense to someone using it? Are the error messages helpful? Would I actually want to use this myself? That's what really shows quality.

### Supplemental Challenge (S_DIST/1340) (AI use: code only)

For Supplemental challenge, we followed the suggestions by Copilot for implementing this feature.

The first thing we do is gathering data of important nodes&edges. We focused more onthe east coast pins, and we specifically are looking for Highway: I-95/ I-295 / US-1/ etc. Cause these routes are the highways most likely to be included in the fastest path. And we asked overpass Api to give us the info above these.

After that we got a list of nodes and ways and removed unnessary points to make file samller, and we saved everything to a JSON file called `east-coast-corridor.json`. We loaded this json everytime we start the server.

And after all these work. We asked `copilot` to write a benchmark tests for us to compare the perfomance of route finding with or without preloading the important route json file.

We choose three following paths for testing since these three paths are both located at east coast and the main highways are the highways we included in our json file.

1.Providence Zoo → Central Park

📈 Improvement:
Speedup: 97.6%
Time saved: 9017ms
Nodes reduction: 66.7%
Tiles reduction: 0.0%

2.Boston → NYC

📈 Improvement:
Speedup: 93.0%
Time saved: 13940ms
Nodes reduction: 67.0%
Tiles reduction: 0.0%

3.Philadelphia → DC
📈 Improvement:
Speedup: 84.5%
Time saved: 5257ms
Nodes reduction: 3.7%
Tiles reduction: 0.0%

# ✨ SUMMARY STATISTICS

Average Speedup: 91.7% faster with preloaded data
Average Time Saved: 9405ms per route
Average Node Reduction: 45.8%
Average Tile Reduction: 0.0%

### Design Choices

#### Errors/Bugs:

#### Tests:

#### How To…

#### Team members and contributions (include cs logins):

rzhou52: TASK A/B 
whu34: TASK C/D supplemental challenge

#### Collaborators (cslogins of anyone you worked with on this project or generative AI):

I used ChatGPT - GPT4.1 to help with understanding the handout. And help me to generate the possible prompts for coiplot. I used copilot claude sonnet 4.5 agent mode to help me with debugging and implementing the TASK C/D and supplemental challenge. I manually checked most of the code and test to ensure everything is working.

The corresponding prompt history could be found in:

#### Total estimated time it took to complete project:

20 hrs

#### Link to GitHub Repo:

https://github.com/cs0320-f25/privacy-and-pathfinding-go-aggies.git

#### Link to asynchronous demo:

https://brown.zoom.us/rec/play/8i6Mid_YjyCUrn1183TtvJodslCZJu8GdYvCtjEYBhzuaqSBZ4-9lU7i9iKJdmaxaxF1ElCUbUH6HECk.VtuDmRn9go_jtJRC?autoplay=true&startTime=1762831349000
