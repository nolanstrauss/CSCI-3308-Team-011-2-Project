# User Acceptance Test (UAT) Plan

## **Feature 1: User Registration**
### **Test Objective**
Verify that users can register successfully with valid credentials and that invalid inputs are handled appropriately.

### **Test Cases**
| Test Case ID | Test Description                              | Test Data                              | Expected Result                                                                 |
|--------------|----------------------------------------------|----------------------------------------|---------------------------------------------------------------------------------|
| TC1.1        | Register with valid username and password    | Username: `testuser`, Password: `Test@123` | User is redirected to the login page. Data is stored in the database.           |
| TC1.2        | Register with an existing username           | Username: `existinguser`, Password: `Test@123` | User is redirected to the registration page with an error message.             |
| TC1.3        | Register with invalid input (e.g., empty fields) | Username: ``, Password: ``             | User is redirected to the registration page with an error message.             |

### **Test Environment**
- **Environment:** Localhost
- **Database:** PostgreSQL (Dockerized)
- **Browser:** Google Chrome (latest version)

### **Test Results**
- Verify that the user data is stored in the `users` table.
- Confirm that error messages are displayed for invalid inputs.

### **User Acceptance Testers**
- Team Member 1: [Name]
- Team Member 2: [Name]

---

## **Feature 2: User Login**
### **Test Objective**
Ensure that users can log in with valid credentials and are redirected to the appropriate page. Invalid credentials should display an error message.

### **Test Cases**
| Test Case ID | Test Description                              | Test Data                              | Expected Result                                                                 |
|--------------|----------------------------------------------|----------------------------------------|---------------------------------------------------------------------------------|
| TC2.1        | Login with valid credentials                 | Username: `testuser`, Password: `Test@123` | User is redirected to the calendar page. Session is created.                   |
| TC2.2        | Login with invalid credentials               | Username: `testuser`, Password: `WrongPass` | User is redirected to the login page with an error message.                    |
| TC2.3        | Login with empty fields                      | Username: ``, Password: ``             | User is redirected to the login page with an error message.                    |

### **Test Environment**
- **Environment:** Localhost
- **Database:** PostgreSQL (Dockerized)
- **Browser:** Google Chrome (latest version)

### **Test Results**
- Verify that the session is created for valid logins.
- Confirm that error messages are displayed for invalid credentials.

### **User Acceptance Testers**
- Team Member 1: [Name]
- Team Member 2: [Name]

---

## **Feature 3: Calendar Event Retrieval**
### **Test Objective**
Ensure that users can view their calendar events after logging in.

### **Test Cases**
| Test Case ID | Test Description                              | Test Data                              | Expected Result                                                                 |
|--------------|----------------------------------------------|----------------------------------------|---------------------------------------------------------------------------------|
| TC3.1        | Retrieve events for a logged-in user         | Username: `testuser`                   | User sees a list of events retrieved from the database.                        |
| TC3.2        | Retrieve events for a user with no events    | Username: `emptyuser`                  | User sees a message indicating no events are available.                        |
| TC3.3        | Access calendar without logging in           | N/A                                    | User is redirected to the login page.                                          |

### **Test Environment**
- **Environment:** Localhost
- **Database:** PostgreSQL (Dockerized)
- **Browser:** Google Chrome (latest version)

### **Test Results**
- Verify that events are retrieved from the `events` table for the logged-in user.
- Confirm that users without events see an appropriate message.
- Ensure unauthorized users are redirected to the login page.

### **User Acceptance Testers**
- Team Member 1: [Tyler Paccione]
- Team Member 2: [Name]

---

## **Risks**
### **Organizational Risks**
- Lack of resources to complete testing on time.
- Limited availability of team members for UAT.

### **Technical Risks**
- Untested code may cause unexpected errors.
- Limited test data may not cover all edge cases.

### **Business Risks**
- Budget constraints may limit testing resources.
- Changes in project requirements may delay testing.

---

## **Execution Plan**
- **Week 4:** Execute the UAT plan and document the results.
- **Test Results:** Include actual observations and screenshots in the final project report.