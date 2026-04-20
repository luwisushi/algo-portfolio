# Algorithm and Complexities Portfolio Website

Portfolio website for **Louise Moreno** built with **Java + HTML + CSS + JavaScript**.

## Features

- Home page with links to:
  - Activities
  - Assignments
  - Projects
- Separate page for each category
- "Go to Home" button on each category page
- Form fields on each category page:
  - Title
  - Date
  - Description
  - Image import (file upload)
- Saved entries are stored in browser local storage per category

## Project Structure

- `src/main/java/com/louisemoreno/portfolio/Main.java` - Java HTTP server
- `src/main/resources/static/index.html` - Home page
- `src/main/resources/static/activities.html` - Activities page
- `src/main/resources/static/assignments.html` - Assignments page
- `src/main/resources/static/projects.html` - Projects page
- `src/main/resources/static/styles.css` - Shared styling
- `src/main/resources/static/app.js` - Shared category page logic

## Run (using installed JDK path)

From the project root:

```powershell
New-Item -ItemType Directory -Force -Path target/classes | Out-Null
& "C:\Program Files\Java\jdk-21\bin\javac.exe" -d target/classes src/main/java/com/louisemoreno/portfolio/Main.java
& "C:\Program Files\Java\jdk-21\bin\java.exe" -cp target/classes com.louisemoreno.portfolio.Main
```

Then open:

- http://localhost:8080

## Run with Maven (optional)

If Maven is installed and available in PATH:

```powershell
mvn compile exec:java
```
