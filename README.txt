CAMPUSGEAR - SMART CAMPUS RESOURCE & GEAR LENDING HUB
Front-end starter project using HTML, CSS, and JavaScript.

HOW TO RUN
1. Extract the ZIP file.
2. Open the campus-lending-hub folder in VS Code.
3. Open index.html in a browser, or use the VS Code Live Server extension.
4. Register a demo account and choose Student, Item Owner, or Admin.
5. Sign in with the same email and password to use that role's dashboard.

PAGES
- index.html: home page
- login.html: login form
- register.html: registration form
- browse.html: search and filter inventory; request to borrow
- student.html: view requests, active borrowings, and history
- owner.html: add listings, approve/reject requests, mark borrow/return
- admin.html: inventory/users/activity overview and JSON export
- style.css: shared responsive styling
- script.js: demo interactions and localStorage data

IMPORTANT LIMITATIONS
- This is a front-end demonstration. Data is stored in the current browser using localStorage, not a shared database.
- Passwords are stored in localStorage for demonstration only. Never store real passwords this way.
- Role selection and dashboard navigation are not secure authorization. Admin access and all permissions must be enforced by a backend.
- Multiple users on different computers will not share data until a backend API and database are added.
- Item photos, email notifications, file uploads, robust date validation, and real university authentication are not implemented.
