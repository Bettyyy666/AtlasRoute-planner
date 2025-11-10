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

### Supplemental Challenge (S_DIST/1340) (AI use: code only)

### Design Choices

#### Errors/Bugs:

#### Tests:

#### How To…

#### Team members and contributions (include cs logins):

#### Collaborators (cslogins of anyone you worked with on this project or generative AI):

#### Total estimated time it took to complete project:

#### Link to GitHub Repo:

#### Link to asynchronous demo:
