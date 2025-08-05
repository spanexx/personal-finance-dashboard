# Orchestrator and Coding Agent Collaboration Guide

## 📋 **Overview**

This document outlines the working relationship between the Orchestrator (GitHub Copilot) and Coding Agents, establishing a clear protocol for effective communication and task management across any software development project.

## 🔄 **Communication Framework**

### **COMMUNICATION.md**

The `COMMUNICATION.md` file serves as the central hub for all interactions between the Orchestrator and Coding Agents. This living document maintains a chronological record of task assignments, progress updates, reviews, and approvals.

#### **Structure of COMMUNICATION.md**

```
# Project Communication Log

## Active Tasks
- [Task #A1] Implement authentication service - Assigned to Agent1
- [Task #B3] Refactor database queries - Assigned to Agent2

## Communication History

### [DATE: YYYY-MM-DD]

#### Task Assignment: Implement User Authentication
🎯 ORCHESTRATOR → AGENT [YYYY-MM-DD HH:MM]
Priority: HIGH
Task: #A1
Action: REQUEST

[Detailed instructions...]

---

#### Task Progress: Implement User Authentication
🤖 AGENT → ORCHESTRATOR [YYYY-MM-DD HH:MM]
Task: #A1
Status: IN PROGRESS

[Progress update with completed items and blockers...]

---

#### Task Review: Implement User Authentication
🎯 ORCHESTRATOR → AGENT [YYYY-MM-DD HH:MM]
Task: #A1
Action: REVIEW

[Review comments with requested changes...]
```

### **Standard Message Formats**

#### **From Orchestrator to Agent**
```
🎯 ORCHESTRATOR → AGENT [YYYY-MM-DD HH:MM]
Priority: [CRITICAL/HIGH/MEDIUM/LOW]
Task: [Task ID]
Action: [REQUEST/UPDATE/REVIEW/APPROVE]

[Message content]

Required Deliverables:
- [ ] Deliverable 1
- [ ] Deliverable 2

Expected Timeline: [Timeframe]
Dependencies: [List of dependencies]
```

#### **From Agent to Orchestrator**
```
🤖 AGENT → ORCHESTRATOR [YYYY-MM-DD HH:MM]
Task: [Task ID]
Status: [NOT STARTED/IN PROGRESS/BLOCKED/READY FOR REVIEW/COMPLETED]

[Message content]

Progress:
- [x] Completed item 1
- [ ] Pending item 2

Questions/Blockers:
- [Question or blocker description]
```

## 🧩 **Role Responsibilities**

### **Orchestrator (GitHub Copilot) Responsibilities**

1. **Strategic Planning**
   - Break down complex requirements into discrete tasks
   - Prioritize tasks based on dependencies and project needs
   - Create a balanced workload across coding agents

2. **Clear Communication**
   - Provide detailed task specifications with context
   - Set explicit expectations for deliverables
   - Establish realistic timelines

3. **Technical Oversight**
   - Ensure architectural consistency across implementations
   - Provide technical guidance when agents encounter obstacles
   - Make critical design decisions when needed

4. **Quality Assurance**
   - Review code for compliance with project standards
   - Verify security considerations are addressed
   - Ensure proper test coverage
   - Validate deliverables against requirements

5. **Project Documentation**
   - Maintain up-to-date task status
   - Document key decisions and their rationale
   - Ensure knowledge transfer across the team

### **Coding Agent Responsibilities**

1. **Task Execution**
   - Implement features according to specifications
   - Follow established coding standards and best practices
   - Create necessary automated tests

2. **Proactive Communication**
   - Provide regular progress updates
   - Flag potential issues early
   - Ask clarifying questions when requirements are ambiguous
   - Document implementation details

3. **Problem Solving**
   - Propose solutions to technical challenges
   - Research and evaluate alternatives
   - Document trade-offs in approach

4. **Quality Focus**
   - Perform self-review before submitting code
   - Address all edge cases
   - Ensure security best practices
   - Write maintainable, readable code

5. **Continuous Improvement**
   - Apply feedback from reviews to future work
   - Stay updated on project patterns and practices
   - Suggest process improvements

## 🔄 **Workflow Process**

### **1. Task Assignment Phase**

1. **Orchestrator**:
   - Creates a detailed task specification
   - Assigns priority and deadline
   - Posts in COMMUNICATION.md
   - Tags the appropriate agent

2. **Coding Agent**:
   - Acknowledges receipt of task
   - Asks clarifying questions if needed
   - Provides initial timeline estimate
   - Updates status to IN PROGRESS

### **2. Development Phase**

1. **Coding Agent**:
   - Implements the task according to specifications
   - Provides regular progress updates
   - Documents any deviations from original plan
   - Flags blockers immediately

2. **Orchestrator**:
   - Monitors progress
   - Unblocks issues when they arise
   - Provides guidance as needed
   - Updates task priorities if required

### **3. Review Phase**

1. **Coding Agent**:
   - Completes implementation
   - Performs self-review
   - Updates status to READY FOR REVIEW
   - Provides summary of changes and testing performed

2. **Orchestrator**:
   - Reviews implementation against requirements
   - Provides specific feedback
   - Either approves or requests changes
   - Updates task status

### **4. Closure Phase**

1. **Orchestrator**:
   - Marks task as COMPLETED
   - Documents any lessons learned
   - Updates project documentation
   - Initiates next tasks

## 📊 **Task Management**

### **Task Status Categories**

- ⏱️ **NOT STARTED**: Task has been defined but work has not begun
- 🔄 **IN PROGRESS**: Work has started but is not complete
- 🚫 **BLOCKED**: Cannot proceed due to external dependencies
- 👀 **READY FOR REVIEW**: Implementation complete, awaiting review
- ✅ **COMPLETED**: Approved and integrated into the project

### **Priority Levels**

- 🚨 **CRITICAL**: Security issues, blocking bugs, or deployment emergencies
- 🔴 **HIGH**: Core functionality, features on critical path
- 🟡 **MEDIUM**: Important features not on critical path
- 🟢 **LOW**: Nice-to-have features, optimizations, refactoring

## 🔍 **Code Review Standards**

### **What to Review**

1. **Functionality**: Does the code work as specified?
2. **Architecture**: Does it follow project patterns?
3. **Performance**: Are there any efficiency concerns?
4. **Security**: Are there potential vulnerabilities?
5. **Maintainability**: Is the code clean and well-documented?
6. **Testing**: Is there adequate test coverage?

### **Review Feedback Format**

```
🎯 ORCHESTRATOR → AGENT [YYYY-MM-DD HH:MM]
Task: [Task ID]
Action: REVIEW

Overall Assessment:
[General impression of the implementation]

Required Changes:
- [Filename]: [Description of required change]
- [Filename]: [Description of required change]

Suggestions:
- [Optional improvements that could be made]

Questions:
- [Any questions about implementation decisions]
```

## 🚨 **Handling Exceptions**

### **Blocked Tasks**

When a task becomes blocked:

1. **Coding Agent**:
   - Immediately updates status to BLOCKED
   - Clearly describes the blocker
   - Provides any available workaround ideas

2. **Orchestrator**:
   - Acknowledges the blocker
   - Works to resolve or reassigns priority
   - May assign alternative tasks in the interim

### **Scope Changes**

When requirements change mid-task:

1. **Orchestrator**:
   - Creates a formal scope change notice
   - Adjusts timelines and deliverables accordingly
   - Documents reasons for change

2. **Coding Agent**:
   - Acknowledges the scope change
   - Provides new estimates if needed
   - Adapts implementation accordingly

### **Technical Disagreements**

When there are differing technical opinions:

1. **Document options** with pros and cons
2. **Focus on project goals** rather than preferences
3. **Defer to Orchestrator** for final decisions while respecting Agent expertise

## 📈 **Continuous Improvement**

Both Orchestrator and Coding Agents should contribute to:

1. **Process refinement** by suggesting workflow improvements
2. **Knowledge sharing** by documenting solutions to recurring issues
3. **Best practices** by establishing and following conventions
4. **Templating** commonly used components and processes

---

This guide serves as the foundation for effective collaboration between Orchestrator and Coding Agents. Both roles should reference it regularly to ensure smooth communication and high-quality output.
