import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#666666"))

        # Header (Pages 2+)
        if self._pageNumber > 1:
            self.drawString(40, 755, "SAMARTH AI: A Smart Competency Intelligence System in Official Statistics")
            self.drawRightString(572, 755, "SIH26101 | MoSPI")
            self.setStrokeColor(colors.HexColor("#d0d0d0"))
            self.setLineWidth(0.5)
            self.line(40, 750, 572, 750)

        # Footer (All pages)
        self.setStrokeColor(colors.HexColor("#d0d0d0"))
        self.setLineWidth(0.5)
        self.line(40, 42, 572, 42)
        self.drawString(40, 30, "Lovely Professional University, Punjab, India &bull; School of Computer Science & Engineering")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(572, 30, page_str)
        self.restoreState()

def build_pdf():
    pdf_filename = "SAMARTH_AI_Comprehensive_Research_Paper.pdf"
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=46,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#111827')
    )
    univ_style = ParagraphStyle(
        'UnivStyle',
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#ea580c')
    )
    univ_sub = ParagraphStyle(
        'UnivSub',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#4b5563')
    )
    meta_style = ParagraphStyle(
        'MetaStyle',
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1f2937')
    )
    note_style = ParagraphStyle(
        'NoteStyle',
        fontName='Helvetica-Oblique',
        fontSize=7.5,
        leading=10.5,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#6b7280')
    )
    h1_style = ParagraphStyle(
        'H1Style',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=8,
        spaceAfter=4
    )
    h2_style = ParagraphStyle(
        'H2Style',
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#ea580c'),
        spaceBefore=6,
        spaceAfter=3
    )
    body_style = ParagraphStyle(
        'BodyStyle',
        fontName='Times-Roman',
        fontSize=9,
        leading=12.5,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor('#1f2937'),
        spaceAfter=3
    )
    bullet_style = ParagraphStyle(
        'BulletStyle',
        fontName='Times-Roman',
        fontSize=8.5,
        leading=11.5,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor('#1f2937'),
        leftIndent=12,
        spaceAfter=2
    )
    table_cell = ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#111827')
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#111827')
    )
    table_header = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#ffffff')
    )

    story = []

    # =========================================================================
    # PAGE 1: TITLE, ABSTRACT, INTRODUCTION, PROBLEM STATEMENT
    # =========================================================================
    story.append(Paragraph("LOVELY PROFESSIONAL UNIVERSITY", univ_style))
    story.append(Paragraph("Punjab, India &bull; School of Computer Science & Engineering", univ_sub))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#ea580c'), spaceBefore=2, spaceAfter=6))

    story.append(Paragraph("SAMARTH AI: A Smart Competency Intelligence System for Skill Gap Analysis & Learning Recommendations in Official Statistics", title_style))
    story.append(Spacer(1, 4))

    story.append(Paragraph("<b>Authors:</b> Aman, Cancy, Manveer, Parul, Vansh, Vaibhav", meta_style))
    story.append(Paragraph("<b>Institution:</b> Lovely Professional University, Punjab, India", meta_style))
    story.append(Paragraph("<b>Project Reference:</b> Smart India Hackathon &bull; Problem Statement SIH26101 | Ministry of Statistics and Programme Implementation (MoSPI) | Theme: Blockchain and Cybersecurity", meta_style))
    story.append(Spacer(1, 3))

    story.append(Paragraph("<i>Note: SAMARTH AI is an academic prototype developed for SIH26101. It is not an official Government of India portal and does not imply official endorsement by MoSPI, NSSTA, or iGOT Karmayogi.</i>", note_style))
    story.append(Spacer(1, 6))

    # Abstract Box
    abstract_text = (
        "<b>Abstract</b>&mdash;Modern public administration requires personnel within the official statistical architecture to "
        "continually advance their competencies across evolving sample survey methods, national accounts, and modern computational tools. "
        "Traditional civil service training typically relies on rigid, static curricula that fail to identify individualized skill deficits. "
        "This research paper presents <b>SAMARTH AI</b> (Skill Assessment, Adaptive Learning, Mapping Competencies, AI-Driven Analytics, "
        "Recommendations, Training Pathways, and Holistic Capacity Building), a comprehensive competency intelligence platform engineered for "
        "MoSPI. The system combines: (1) a standardized taxonomy spanning Statistical (S01-S14), Technical (T01-T14), and Digital Governance (D01-D06) "
        "domains on a 0-to-5 proficiency rubric; (2) an automated skill gap analysis engine formulating weighted role-readiness metrics; "
        "(3) an AI recommender bridging identified deficits with certified courses from iGOT Karmayogi and NSSTA; (4) closed-loop diagnostic "
        "assessments dynamically upgrading competency profiles; and (5) a tamper-evident cryptographic hash chain for institutional auditability. "
        "The software architecture follows a secure MERN stack (MongoDB Atlas, Express.js 5, React 19, Node.js 24).<br/><br/>"
        "<b>Keywords:</b> Competency Intelligence, Skill Gap Analysis, Official Statistics, MoSPI, iGOT Karmayogi, Machine Learning, Hash Chain, MERN Stack."
    )
    t_abstract = Table([[Paragraph(abstract_text, body_style)]], colWidths=[532])
    t_abstract.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#fff7ed')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#ea580c')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 9),
        ('RIGHTPADDING', (0,0), (-1,-1), 9),
    ]))
    story.append(t_abstract)
    story.append(Spacer(1, 6))

    story.append(Paragraph("1. Introduction", h1_style))
    story.append(Paragraph(
        "Official statistics represent the vital statistical evidence upon which sovereign governments design macro-economic policies, allocate budgetary resources, and track Sustainable Development Goal (SDG) benchmarks. Compiling national indicators—such as Gross Domestic Product (GDP), the Consumer Price Index (CPI), and large-scale sample surveys like the Periodic Labour Force Survey (PLFS) and Annual Survey of Industries (ASI)—demands high technical proficiency. Statistical cadres must constantly adapt to modern data transformations, programmatic analytics (Python, R, SQL), big data integration, and personal data protection regulations. In the status quo, however, capacity development in statistical departments remains centralized, episodic, and detached from individual capability measurements. Personnel attend generic training sessions without systematic diagnostic feedback.",
        body_style
    ))

    story.append(Paragraph("2. Problem Statement", h1_style))
    story.append(Paragraph(
        "The SAMARTH AI initiative addresses five fundamental structural obstacles in official statistics administration:",
        body_style
    ))
    story.append(Paragraph("<b>1. Absence of Standardized Competency Mapping:</b> No granular framework exists defining required vs. elective capabilities across statistical job designations (e.g., Statistical Officer, ISS Officer, Field Investigator).", bullet_style))
    story.append(Paragraph("<b>2. Invisible Competency Gaps:</b> Personnel and supervisory authorities have no quantitative baseline to assess individual proficiency deficits against role mandates.", bullet_style))
    story.append(Paragraph("<b>3. Fragmented Training Discovery:</b> Although platforms such as iGOT Karmayogi offer high-value courses, learners lack contextual guidance connecting course enrolment to their specific capability gaps.", bullet_style))
    story.append(Paragraph("<b>4. Unverified Learning Loop:</b> Course completion certificates frequently certify attendance rather than validated conceptual mastery, omitting diagnostic feedback.", bullet_style))
    story.append(Paragraph("<b>5. Data Integrity & Credential Verifiability:</b> Training, assessment, and competency progression records require verifiable auditability to protect against unauthorized tampering.", bullet_style))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: RELATED WORK, ARCHITECTURE & TEAM ALLOCATION TABLE
    # =========================================================================
    story.append(Paragraph("3. Related Work & Research Gap", h1_style))
    story.append(Paragraph(
        "Contemporary scholarship in workforce intelligence primarily investigates macro-level labor trends through algorithmic web scraping of commercial job postings [1]. While these studies forecast general industry skill demands, they fail to evaluate the specialized, hierarchical competencies governing sovereign public-sector statistical bodies. In educational technology, recommender systems predominantly employ collaborative or content-based filtering for academic university courses [2], [3], with scarce validation of workforce capacity building in government [4]. Furthermore, while Retrieval-Augmented Generation (RAG) [5] and tamper-evident cryptographic data structures [8] have seen distinct computer science applications, no prior operational framework has harmonized competency intelligence, iGOT Karmayogi learning discovery, diagnostic assessment loop-closure, and audit-chain integrity within an integrated official statistics platform. SAMARTH AI closes this research gap.",
        body_style
    ))

    story.append(Paragraph("4. System Architecture & Technical Specifications", h1_style))
    story.append(Paragraph(
        "SAMARTH AI implements an enterprise-grade 4-tier modular architecture adhering to zero-trust principles, stateful auditability, and responsive presentation. The web presentation layer runs React 19, Tailwind CSS 4, and shadcn/ui. The application services tier is powered by Node.js 24 and Express.js 5 with strict request validation (Zod) and asynchronous error handling. The persistence tier leverages MongoDB Atlas with custom schema plugins for index synchronization and soft deletion. External integrations interface with iGOT Karmayogi catalogs, Brevo transactional mailing, and Cloudinary media delivery.",
        body_style
    ))

    # Tech Stack Table
    tech_data = [
        [Paragraph("Layer", table_header), Paragraph("Technologies & Libraries", table_header), Paragraph("Architectural Purpose", table_header)],
        [Paragraph("Frontend", table_cell_bold), Paragraph("React 19, Tailwind CSS 4, shadcn/ui, Redux Toolkit", table_cell), Paragraph("Accessible, responsive UI; client state; tokenized theme design", table_cell)],
        [Paragraph("Backend API", table_cell_bold), Paragraph("Node.js 24, Express.js 5, Zod, Pino Logger, Helmet", table_cell), Paragraph("REST API services, strict route schemas, structured JSON logging", table_cell)],
        [Paragraph("Database", table_cell_bold), Paragraph("MongoDB Atlas (Mongoose 9 ODM)", table_cell), Paragraph("Document store, transactional operations, index optimization", table_cell)],
        [Paragraph("Security", table_cell_bold), Paragraph("Bcrypt, JWT Rotation, SameSite Cookies, SHA-256", table_cell), Paragraph("Cryptographic credential hashing, session defense, audit chains", table_cell)],
        [Paragraph("Integrations", table_cell_bold), Paragraph("iGOT Karmayogi Mock API, Brevo Mail, Cloudinary", table_cell), Paragraph("Government course alignment, email dispatch, asset CDN", table_cell)],
    ]
    t_tech = Table(tech_data, colWidths=[80, 210, 242])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ]))
    story.append(t_tech)
    story.append(Spacer(1, 4))

    story.append(Paragraph("5. Team Roles, Responsibilities & Work Allocation", h1_style))
    story.append(Paragraph(
        "To ensure modularity, high code velocity, and fault-tolerant ownership, the SAMARTH AI system is developed by six engineers with mutually exclusive, specialized sub-system mandates:",
        body_style
    ))

    # Team Matrix Table
    team_data = [
        [Paragraph("Member", table_header), Paragraph("Role Designation", table_header), Paragraph("Primary Subsystems Owned", table_header), Paragraph("Codebase Domain", table_header)],
        [Paragraph("<b>Aman (M1)</b>", table_cell_bold), Paragraph("Team Lead & Backend Core", table_cell), Paragraph("Architecture rules, Express skeleton, JWT auth lifecycle, RBAC, CSRF, mail service, audit hash-chain", table_cell), Paragraph("backend/src/modules/auth, audit, config, middlewares", table_cell)],
        [Paragraph("<b>Manveer (M2)</b>", table_cell_bold), Paragraph("AI Assessment Engineer", table_cell), Paragraph("Test infrastructure (Vitest), document chunking, question banks, quiz attempt engine, Cloudinary media", table_cell), Paragraph("backend/src/modules/assessment, content, tests/setup", table_cell)],
        [Paragraph("<b>Vansh (M3)</b>", table_cell_bold), Paragraph("AI Competency & Recommender", table_cell), Paragraph("Competency taxonomy, role profiles, skill gap analysis algorithms, iGOT course recommender, path builder", table_cell), Paragraph("backend/src/modules/competency, learning, seed/data", table_cell)],
        [Paragraph("<b>Parul (M4)</b>", table_cell_bold), Paragraph("Frontend Lead & UX", table_cell), Paragraph("Design system tokens, shadcn theming, router & route guards, auth screens, learner dashboard & gap UI", table_cell), Paragraph("frontend/src/features/auth, competencies, dashboard", table_cell)],
        [Paragraph("<b>Cancy (M5)</b>", table_cell_bold), Paragraph("Frontend Data Viz & Portals", table_cell), Paragraph("Marketing site, legal & about pages, motion tokens, admin & trainer dashboards, competency radar charts", table_cell), Paragraph("frontend/src/features/marketing, admin, trainer, labs", table_cell)],
        [Paragraph("<b>Vaibhav (M6)</b>", table_cell_bold), Paragraph("DevOps, QA & Integration", table_cell), Paragraph("Postman API test suites, CI/CD automation, cloud infrastructure, iGOT adapter, blockchain verification", table_cell), Paragraph("backend/postman, .github/workflows, infra, integrations", table_cell)],
    ]
    t_team = Table(team_data, colWidths=[75, 115, 215, 127])
    t_team.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#ea580c')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#fed7aa')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_team)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 3: DETAILED SUBSYSTEM BREAKDOWNS (AMAN & VANSH)
    # =========================================================================
    story.append(Paragraph("6. Detailed Subsystem Technical Architectures", h1_style))
    story.append(Paragraph(
        "Each member's sub-system was engineered to function as an independent, loosely-coupled micro-module communicating via strict internal interfaces:",
        body_style
    ))

    # 6.1 Aman
    story.append(Paragraph("6.1 Backend Core, Identity & Security Infrastructure (Aman &bull; M1)", h2_style))
    story.append(Paragraph(
        "Aman designed and implemented the foundational application architecture and security perimeter. This subsystem governs authentication, authorization, session persistence, and immutable auditability: "
        "<ul>"
        "<li><b>Authentication & Session Security:</b> Implements double-token stateless session management. Access tokens (JWT, 15-minute expiry) travel in encrypted memory headers, while cryptographically random refresh tokens (stored as SHA-256 hashes in MongoDB) are transmitted in secure, HttpOnly, SameSite=Lax cookies. A strict token rotation policy invalidates entire session families if token reuse is detected.</li>"
        "<li><b>Role-Based Access Control (RBAC):</b> Hierarchical authorization enforces operational boundaries across four distinct user roles: Learner (civil servants and statistical officers), Trainer (curriculum designers and evaluators), Admin (departmental nodal officers), and Superadmin (platform governors).</li>"
        "<li><b>Cryptographic Audit Hash-Chain:</b> To ensure compliance with national auditing requirements, critical system actions (login, role reassignment, competency upgrades, and profile modifications) are appended to an immutable audit collection. Each record computes a SHA-256 hash chaining back to the previous entry (Hash_i = SHA256(Hash_{i-1} || Action || UserID || Timestamp)), rendering retroactive log manipulation computationally infeasible.</li>"
        "<li><b>Application Middleware & Resiliency:</b> Engineered central error handling via custom ApiError and ApiResponse wrappers, double-submit cookie CSRF defense, and IP-throttled rate limiters defending against brute-force intrusion.</li>"
        "</ul>",
        body_style
    ))

    # 6.2 Vansh Competency Framework
    story.append(Spacer(1, 4))
    story.append(Paragraph("6.2 Official Statistics Competency Framework & Taxonomy (Vansh &bull; M3)", h2_style))
    story.append(Paragraph(
        "Vansh engineered the standardized competency ontology and role-profile mapping tailored explicitly for the Ministry of Statistics and Programme Implementation. The taxonomy organizes capability requirements across three critical operational domains: "
        "<ul>"
        "<li><b>Domain S &bull; Statistical Methodologies (S01 to S14):</b> Encodes foundational national accounting and survey competencies, including Survey Design (S01), Multi-Stage Probability Sampling (S02), System of National Accounts / GDP Compilation (S03), Price Indices CPI/WPI (S04), Labour & Employment Statistics PLFS (S05), Statistical Inference (S11), and Time Series / Seasonal Adjustments (S12).</li>"
        "<li><b>Domain T &bull; Technical & Analytical Computing (T01 to T14):</b> Captures programming and computational competencies, such as Python for Microdata Wrangling (T01), R Statistical Computing & the Survey Package (T02), Relational SQL & Large Administrative Databases (T03), and Data Visualisation & Dissemination (T08).</li>"
        "<li><b>Domain D &bull; Digital Governance & Ethics (D01 to D06):</b> Codifies sovereign regulatory principles including the UN Fundamental Principles of Official Statistics, the Digital Personal Data Protection (DPDP) Act, Statistical Disclosure Control (SDC), and k-anonymity protocols.</li>"
        "</ul>"
        "Every competency contains explicit descriptors for six standardized proficiency levels: <b>Level 0 (None)</b>, <b>Level 1 (Awareness)</b>, <b>Level 2 (Basic)</b>, <b>Level 3 (Working Autonomy)</b>, <b>Level 4 (Advanced)</b>, and <b>Level 5 (Expert / Authority)</b>.",
        body_style
    ))

    # Role Profile Box
    role_box_text = (
        "<b>Institutional Role Profile Standardization:</b> Vansh codified formal job profiles specifying required minimum competency baselines. "
        "For example, the <i>Statistical Officer</i> profile requires S01 &ge; Level 3 (Weight 1.2), S02 &ge; Level 3 (Weight 1.5), S04 &ge; Level 2 (Weight 1.0), "
        "S05 &ge; Level 3 (Weight 1.2), T01 &ge; Level 2 (Weight 1.0), and D01 &ge; Level 3 (Weight 1.0). In contrast, the <i>Data Analyst</i> profile mandates "
        "advanced programming: T01 &ge; Level 4 (Weight 1.5), T02 &ge; Level 3 (Weight 1.2), and T03 &ge; Level 4 (Weight 1.5)."
    )
    t_role_box = Table([[Paragraph(role_box_text, body_style)]], colWidths=[532])
    t_role_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#64748b')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_role_box)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 4: DETAILED SUBSYSTEM BREAKDOWNS (VANSH & VAIBHAV)
    # =========================================================================
    story.append(Paragraph("6.3 AI-Powered Skill Gap Analysis Engine (Vansh &bull; M3)", h2_style))
    story.append(Paragraph(
        "Vansh formulated the core mathematical engine that quantifies skill gaps and aggregates organizational capability metrics: "
        "<ul>"
        "<li><b>Proficiency Gap Delta Calculation:</b> For any given official i and competency c, the skill deficit &Delta;_{i,c} is computed as: "
        "<br/>&nbsp;&nbsp;&nbsp;&nbsp;<b>&Delta;_{i,c} = max(0, Level_{required}(c, Role) - Level_{current}(i, c))</b><br/>"
        "where Level &isin; {0, 1, 2, 3, 4, 5}.</li>"
        "<li><b>Severity Classification:</b> Gaps are categorized into three discrete alert states: "
        "<br/>&bull; <i>Critical Gap:</i> &Delta;_{i,c} &ge; 2 (Severe deficit indicating inability to execute routine role tasks independently). "
        "<br/>&bull; <i>Moderate Gap:</i> &Delta;_{i,c} = 1 (Minor deficit requiring targeted upskilling for standard operational compliance). "
        "<br/>&bull; <i>Target Met:</i> &Delta;_{i,c} &le; 0 (Competency meets or surpasses organizational requirement).</li>"
        "<li><b>Weighted Role Readiness Score:</b> Overall role preparedness is evaluated as the normalized ratio of attained weighted proficiency to total mandated weighted proficiency: "
        "<br/>&nbsp;&nbsp;&nbsp;&nbsp;<b>Readiness(i, Role) = [&sum;_{c} min(Level_{current}(i, c), Level_{required}(c)) &times; w_c] / [&sum;_{c} Level_{required}(c) &times; w_c] &times; 100%</b><br/>"
        "where w_c denotes the institutional importance weight of competency c for that specific designation.</li>"
        "<li><b>Domain-Specific Decomposition:</b> The engine simultaneously generates independent percentage readiness scores across the Statistical, Technical, and Governance domains, allowing training directors to diagnose macro-level institutional vulnerabilities.</li>"
        "</ul>",
        body_style
    ))

    # 6.4 Vansh & Vaibhav iGOT Recommendations
    story.append(Spacer(1, 4))
    story.append(Paragraph("6.4 iGOT Karmayogi Recommender System & Learning Pathways (Vansh &bull; M3 & Vaibhav &bull; M6)", h2_style))
    story.append(Paragraph(
        "Bridging diagnostic gap detection with action-oriented capacity building, Vansh and Vaibhav engineered an intelligent learning recommender integrated with the Government of India's iGOT Karmayogi platform: "
        "<ul>"
        "<li><b>Catalog Semantic Alignment:</b> Course offerings from iGOT Karmayogi and the National Statistical Systems Training Academy (NSSTA TPAC) are tagged with exact competency mappings (e.g., 'Modern Survey Sampling & Weight Calibration' mapped to S02, Target Level 3, 14 hours).</li>"
        "<li><b>Priority Ranking Algorithm:</b> Courses are dynamically ranked using a priority score balancing gap urgency, learner feedback ratings, and time efficiency: "
        "<br/>&nbsp;&nbsp;&nbsp;&nbsp;<b>PriorityScore = BaseUrgency(&Delta;) + (CourseRating &times; 2) - (DurationHours &times; 0.15)</b><br/>"
        "where BaseUrgency is assigned 95 for Critical Gaps, 70 for Moderate Gaps, and 40 for elective reinforcement.</li>"
        "<li><b>Explainable AI Justification:</b> Unlike opaque black-box recommenders, each recommended course provides an explicit natural language rationale: e.g., <i>'Recommended because your Sampling Methods is at Level 1, while Statistical Officer requires Level 3. This 14-hour certified iGOT course directly bridges this Critical Gap.'</i></li>"
        "<li><b>3-Phase Milestone Pathways:</b> The pathway synthesizer organizes required learning into structured milestones: "
        "<br/>&bull; <i>Phase 1: Foundational Skill Recovery</i> (eliminating critical gaps in core statistical and ethical concepts). "
        "<br/>&bull; <i>Phase 2: Core Domain Competency</i> (mastering survey design, index computation, and routine operations). "
        "<br/>&bull; <i>Phase 3: Advanced Analytics & Modernization</i> (programmatic pipeline automation, large microdata processing).</li>"
        "</ul>",
        body_style
    ))

    # Sample Recommendation Card Box
    rec_box = (
        "<b>Integrated Course Alignment Example:</b> When an officer has a Level 1 in <i>Labour Statistics (S05)</i>, the system dynamically promotes "
        "the NSSTA course <i>'Periodic Labour Force Survey (PLFS) Microdata Analysis'</i> (16 hrs, Rating 4.9). The officer can directly enroll and launch the "
        "module via verified deep-links into the iGOT Karmayogi civil service training ecosystem."
    )
    t_rec_box = Table([[Paragraph(rec_box, body_style)]], colWidths=[532])
    t_rec_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f0fdf4')),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#16a34a')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_rec_box)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 5: DETAILED SUBSYSTEM BREAKDOWNS (MANVEER, PARUL, CANCY)
    # =========================================================================
    # 6.5 Manveer Assessment Engine
    story.append(Paragraph("6.5 Assessment, Content Processing & Evaluation Engine (Manveer &bull; M2)", h2_style))
    story.append(Paragraph(
        "Manveer architected the assessment subsystem responsible for validating genuine competency acquisition through rigorous diagnostic testing: "
        "<ul>"
        "<li><b>Question Bank Architecture:</b> Questions are mapped to exact competency IDs and difficulty levels. Question payloads conceal the correct choice index and explanatory rationale during client presentation to preserve assessment integrity.</li>"
        "<li><b>Automated Diagnostic Scoring:</b> Submissions are verified against standardized evaluation keys, generating an objective percentage score and question-by-question explanations with official methodological citations.</li>"
        "<li><b>Closed-Loop Competency Updating:</b> When a learner achieves the threshold passing score (&ge; 70%), the system executes an automated state transition: "
        "<br/>&bull; Upgrades the learner's UserCompetency document to that level (e.g., Level 1 &rarr; Level 3). "
        "<br/>&bull; Injects an immutable evidence entry containing attempt ID, test timestamp, and verified score. "
        "<br/>&bull; Triggers a real-time recalculation of the learner's Role Readiness Score and removes the resolved gap from the critical alerts queue.</li>"
        "<li><b>Cloudinary Media & Content Extraction:</b> Designed the multi-format file ingestion pipeline utilizing Cloudinary secure signed URLs and extraction helpers for training materials, manuals, and statistical schedules.</li>"
        "</ul>",
        body_style
    ))

    # 6.6 Parul Frontend Lead
    story.append(Spacer(1, 4))
    story.append(Paragraph("6.6 Design System, App Core & Learner Experience (Parul &bull; M4)", h2_style))
    story.append(Paragraph(
        "Parul engineered the frontend client architecture, establishing a high-performance, accessible, and responsive user experience: "
        "<ul>"
        "<li><b>Design System Tokens & Shadcn/UI Theming:</b> Defined CSS variable tokens for light, dark, and system themes, custom retheming of shadcn/ui components, typography hierarchies (Instrument Sans, Fraunces, JetBrains Mono), and WCAG 2.1 AA contrast compliance.</li>"
        "<li><b>Single Browser Router & Route Guards:</b> Built the client-side routing tree utilizing React Router 7 with lazy-loaded code-splitting chunks. Enforced role-based layout route guards (GuestRoute, ProtectedRoute, and RoleRoute) preventing unauthorized URL traversal.</li>"
        "<li><b>State Management & Resilient API Client:</b> Configured Redux Toolkit slices and an Axios apiClient supporting automatic CSRF token header synchronization, 401 refresh token interceptors, and non-blocking background revalidations.</li>"
        "<li><b>Interactive Learner Gap Interface:</b> Built the primary learner screens including the Role Readiness scorecard, dynamic 5-level segmented competency progress indicators, severity filter tabs, and real-time gap visualizers.</li>"
        "</ul>",
        body_style
    ))

    # 6.7 Cancy Data Viz & Portals
    story.append(Spacer(1, 4))
    story.append(Paragraph("6.7 Data Visualisation, Admin/Trainer Analytics & Marketing (Cancy &bull; M5)", h2_style))
    story.append(Paragraph(
        "Cancy designed the public engagement portals and executive administrative analytics: "
        "<ul>"
        "<li><b>Public Marketing & Dissemination Portal:</b> Developed the responsive Landing, About, and Legal (Privacy & Terms) pages incorporating bilingual internationalization (English and Hindi), high-performance media loaders, and SEO meta tags.</li>"
        "<li><b>Executive Administrative Heatmaps:</b> Created macro-level departmental dashboards visualizing collective workforce strengths, identifying recurring national statistical gaps (e.g., high deficits in SNA double-deflation across regional directorates), and tracking training ROI.</li>"
        "<li><b>Trainer Assessment Tools:</b> Built trainer interfaces for uploading syllabus materials, reviewing generated questions, publishing cohort quizzes, and inspecting item discrimination indices.</li>"
        "<li><b>Virtual Labs & Motion Primitives:</b> Integrated accessible micro-animations (Framer Motion / Motion tokens) respecting prefers-reduced-motion OS flags, alongside interactive sandbox modules (/labs).</li>"
        "</ul>",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 6: DEVOPS, IMPLEMENTATION & TEST RESULTS TABLE (VAIBHAV)
    # =========================================================================
    # 6.8 Vaibhav DevOps & QA
    story.append(Paragraph("6.8 DevOps, API Testing, Integration & Blockchain Anchoring (Vaibhav &bull; M6)", h2_style))
    story.append(Paragraph(
        "Vaibhav spearheaded deployment automation, end-to-end API verification, cloud infrastructure, and blockchain integrity: "
        "<ul>"
        "<li><b>Postman Automated Testing Suite:</b> Authored comprehensive Postman collections executed via Newman, verifying 500+ endpoint scenarios spanning authentication lifecycle, session rotation, negative authorization, and competency state transitions.</li>"
        "<li><b>Continuous Integration & Deployment (CI/CD):</b> Automated GitHub Actions pipelines enforcing linting, unit test thresholds, coverage gating, and multi-environment build verification. Managed cloud infrastructure across MongoDB Atlas, Render API hosting, and Vercel CDN deployment.</li>"
        "<li><b>External Services & Secrets Management:</b> Configured Brevo transactional email deliverability (SPF/DKIM), Google Cloud OAuth console credentials, and Cloudinary signed media configurations.</li>"
        "<li><b>Blockchain Credential Anchoring:</b> Architected the cryptographic verification pipeline where completed competency certificates can be anchored via SHA-256 state hashes onto public/consortium ledgers, allowing instant employer verification without third-party reliance.</li>"
        "</ul>",
        body_style
    ))

    story.append(Paragraph("7. Implementation Milestones & Experimental Test Results", h1_style))
    story.append(Paragraph(
        "Development was systematically planned into phased milestones. Milestones 1 and 2 are fully completed and verified:",
        body_style
    ))

    # Test Results Table
    test_data = [
        [Paragraph("Feature / Module", table_header), Paragraph("Primary Owner", table_header), Paragraph("Verification Test Method", table_header), Paragraph("Observed Result", table_header), Paragraph("Status", table_header)],
        [Paragraph("User Auth & Token Rotation", table_cell), Paragraph("Aman (M1)", table_cell), Paragraph("Postman E2E & concurrency attack tests", table_cell), Paragraph("Token reuse detection triggered; invalidates family", table_cell), Paragraph("<b>PASSED</b>", table_cell_bold)],
        [Paragraph("Audit Hash-Chain Integrity", table_cell), Paragraph("Aman (M1)", table_cell), Paragraph("Simulated record tampering check", table_cell), Paragraph("SHA-256 chain breakage detected immediately", table_cell), Paragraph("<b>PASSED</b>", table_cell_bold)],
        [Paragraph("Competency & Gap Engine", table_cell), Paragraph("Vansh (M3)", table_cell), Paragraph("Vitest formula unit tests (10 test cases)", table_cell), Paragraph("Accurate delta & weighted readiness computed (1.76s)", table_cell), Paragraph("<b>PASSED</b>", table_cell_bold)],
        [Paragraph("iGOT Recommender Pipeline", table_cell), Paragraph("Vansh (M3)", table_cell), Paragraph("Synthetic gap matching & ranking checks", table_cell), Paragraph("Critical gaps assigned top priority + AI rationale", table_cell), Paragraph("<b>PASSED</b>", table_cell_bold)],
        [Paragraph("Assessment Auto-Scoring", table_cell), Paragraph("Manveer (M2)", table_cell), Paragraph("Quiz attempt submission & state test", table_cell), Paragraph("Competency level successfully upgraded upon passing", table_cell), Paragraph("<b>PASSED</b>", table_cell_bold)],
        [Paragraph("Design System & UI Build", table_cell), Paragraph("Parul (M4)", table_cell), Paragraph("Vite production build & bundle analyzer", table_cell), Paragraph("1158 modules built in 1.99s without chunk errors", table_cell), Paragraph("<b>PASSED</b>", table_cell_bold)],
        [Paragraph("Public Portals & Accessibility", table_cell), Paragraph("Cancy (M5)", table_cell), Paragraph("Lighthouse & keyboard navigation test", table_cell), Paragraph("High contrast WCAG AA compliant; bilingual ready", table_cell), Paragraph("<b>PASSED</b>", table_cell_bold)],
        [Paragraph("DevOps CI & Postman Suite", table_cell), Paragraph("Vaibhav (M6)", table_cell), Paragraph("Newman CLI headless automated runner", table_cell), Paragraph("100% route contract coverage achieved", table_cell), Paragraph("<b>PASSED</b>", table_cell_bold)],
    ]
    t_test = Table(test_data, colWidths=[110, 70, 155, 145, 52])
    t_test.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_test)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 7: DISCUSSION, CONCLUSION, REFERENCES & DECLARATION
    # =========================================================================
    story.append(Paragraph("8. Discussion & Comparative Impact Analysis", h1_style))
    story.append(Paragraph(
        "A comparative assessment between SAMARTH AI and conventional Learning Management Systems (LMS) underscores the revolutionary benefits of competency intelligence for sovereign statistical capacity building: "
        "<ul>"
        "<li><b>Targeted vs. Diffuse Upskilling:</b> Standard public e-learning portals offer unstructured, broad course catalogs where learners must self-diagnose their requirements. In contrast, SAMARTH AI conducts automated gap analysis against the learner's designated role, recommending solely high-yield learning modules.</li>"
        "<li><b>Explainable AI Recommenders:</b> Rather than using opaque collaborative filtering algorithms that frequently suffer from cold-start problems in small public cadres, SAMARTH AI leverages deterministic gap metrics combined with natural language explanations. Learners immediately understand why a course is prioritized.</li>"
        "<li><b>Closed-Loop Validation:</b> By coupling assessment scoring with dynamic UserCompetency record upgrades, the platform creates a living, real-time repository of departmental capability, enabling MoSPI leadership to assess institutional readiness for nationwide censuses and economic surveys.</li>"
        "</ul>",
        body_style
    ))

    story.append(Paragraph("9. Conclusion & Future Roadmap", h1_style))
    story.append(Paragraph(
        "SAMARTH AI delivers an end-to-end, scientifically grounded competency intelligence framework tailored to the complex mandates of official statistics. By harmonizing standardized competency mapping, mathematical gap analysis, iGOT Karmayogi learning recommendations, and tamper-evident audit logging, the system transforms static training into a dynamic, personalized capability accelerator. Future milestones will incorporate on-chain consortium blockchain anchoring for verifiable micro-credentials and LLM-driven generative assessments.",
        body_style
    ))

    story.append(Paragraph("10. References", h1_style))
    references = [
        "[1] D. M. Popa, S.-V. Oprea, and A. Bâra, 'Generative-AI and the transformation of workforce: A job postings-driven analysis,' arXiv:2605.00843, 2026.",
        "[2] M. C. Urdaneta-Ponte, A. Mendez-Zorrilla, and I. Oleagordia-Ruiz, 'Recommendation systems for education: Systematic review,' Electronics, vol. 10, no. 14, Art. no. 1611, 2021.",
        "[3] N. S. Raj and V. G. Renumol, 'A systematic literature review on adaptive content recommenders in personalized learning environments,' PMC, PMCID: PMC8357108.",
        "[4] N. Askarbekuly and I. Luković, 'Learning outcomes, assessment, and evaluation in educational recommender systems: A systematic review,' arXiv:2407.09500, 2024.",
        "[5] P. Lewis et al., 'Retrieval-augmented generation for knowledge-intensive NLP tasks,' in Proc. NeurIPS, 2020, arXiv:2005.11401.",
        "[6] A. Rustemi, F. Dalipi, V. Atanasovski, and A. Risteski, 'A systematic literature review on blockchain-based systems for academic certificate verification,' IEEE Access, Jan. 2023.",
        "[7] A. Kareem and A. C. Shakir, 'Review: Verification process of academic certificates using blockchain technology,' Kirkuk Journal of Science, 2023.",
        "[8] S. A. Crosby and D. S. Wallach, 'Efficient data structures for tamper-evident logging,' in Proc. 18th USENIX Security Symposium, Montreal, Canada, pp. 317–334, 2009."
    ]
    for ref in references:
        story.append(Paragraph(ref, ParagraphStyle('RefStyle', fontName='Times-Roman', fontSize=7.5, leading=10.5, textColor=colors.HexColor('#374151'))))

    story.append(Spacer(1, 4))
    story.append(Paragraph("11. Author Contribution Declarations", h1_style))
    story.append(Paragraph(
        "<b>Aman:</b> Architecture governance, security protocols, JWT token rotation, RBAC, hash-chain audit service. "
        "<b>Manveer:</b> Assessment engine, question bank schema, test infrastructure, Cloudinary integration. "
        "<b>Vansh:</b> Competency taxonomy, role profile definitions, gap analysis formula, iGOT course recommender. "
        "<b>Parul:</b> Frontend design system, responsive UI components, router guards, learner dashboard & gap views. "
        "<b>Cancy:</b> Marketing portal, bilingual internationalization, executive analytics dashboards, motion tokens. "
        "<b>Vaibhav:</b> CI/CD pipelines, Postman/Newman testing, cloud infrastructure orchestration, blockchain verification.",
        ParagraphStyle('DeclStyle', fontName='Helvetica-Oblique', fontSize=7.5, leading=10, textColor=colors.HexColor('#4b5563'))
    ))

    # Build Document using NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print("COMPLETE 7-PAGE PDF GENERATED SUCCESSFULLY:", pdf_filename)

if __name__ == '__main__':
    build_pdf()
