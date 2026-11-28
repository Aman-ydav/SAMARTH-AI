import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT

def generate_pdf():
    pdf_filename = "SAMARTH_AI_Research_Paper.pdf"
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1a1a1a')
    )

    univ_style = ParagraphStyle(
        'UnivStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#d9531e')
    )

    univ_sub = ParagraphStyle(
        'UnivSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#555555')
    )

    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#333333')
    )

    note_style = ParagraphStyle(
        'NoteStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=11.5,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor('#555555')
    )

    h2_style = ParagraphStyle(
        'H2Style',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#1a1a1a'),
        spaceBefore=10,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['BodyText'],
        fontName='Times-Roman',
        fontSize=9.5,
        leading=13.5,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor('#222222')
    )

    abstract_style = ParagraphStyle(
        'AbstractStyle',
        parent=styles['Normal'],
        fontName='Times-Roman',
        fontSize=9,
        leading=13,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor('#222222')
    )

    story = []

    # University Header
    story.append(Paragraph("LOVELY PROFESSIONAL UNIVERSITY", univ_style))
    story.append(Paragraph("Punjab, India &bull; School of Computer Science & Engineering", univ_sub))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#d9531e'), spaceBefore=2, spaceAfter=10))

    # Paper Title
    story.append(Paragraph("SAMARTH AI: A Smart Competency Intelligence System for Skill Gap Analysis & Learning Pathways in Official Statistics", title_style))
    story.append(Spacer(1, 8))

    # Authors & Project Reference
    story.append(Paragraph("<b>Authors:</b> Aman, Cancy, Manveer, Parul, Vansh, Vaibhav", meta_style))
    story.append(Paragraph("<b>Institution:</b> Lovely Professional University, Punjab, India", meta_style))
    story.append(Paragraph("<b>Project Reference:</b> Smart India Hackathon, Problem Statement SIH26101 | Ministry of Statistics and Programme Implementation (MoSPI) | Theme: Blockchain and Cybersecurity", meta_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("<i>Note: SAMARTH AI is an academic student prototype. It is not an official Government of India website and does not imply official endorsement by MoSPI, NSSTA, iGOT or the Government.</i>", note_style))
    story.append(Spacer(1, 10))

    # Abstract Box
    abstract_content = [
        [Paragraph("<b>Abstract</b>&mdash;Public administration and economic stewardship require official statistics professionals to continually update competencies as analytical technologies and survey methodologies evolve. Traditional training models apply rigid, one-size-fits-all curricula that fail to pinpoint individual proficiency deficits or recommend targeted learning. This paper presents <b>SAMARTH AI</b>, an integrated platform developed for SIH26101 under MoSPI. SAMARTH AI combines: (1) a multi-domain competency framework (Statistical, Technical, Digital Governance) spanning levels 0 to 5; (2) an automated skill gap analysis engine calculating quantitative role-readiness scores; (3) an AI recommender mapping gaps directly to certified learning courses from iGOT Karmayogi and NSSTA; and (4) diagnostic quiz assessments that dynamically validate skill acquisition and close the competency loop. The platform is engineered with the MERN stack (MongoDB, Express, React, Node.js).<br/><br/><b>Keywords:</b> Competency Intelligence, Skill Gap Analysis, Official Statistics, MoSPI, iGOT Karmayogi, MERN Stack, AI Recommendations.", abstract_style)]
    ]
    t_abstract = Table(abstract_content, colWidths=[530])
    t_abstract.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#fcf8f2')),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#d9531e')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_abstract)
    story.append(Spacer(1, 10))

    # 1. Introduction
    story.append(Paragraph("1. Introduction", h2_style))
    story.append(Paragraph("Official statistics form the factual foundation for national policy decisions, economic planning, and sustainable development monitoring. Producing dependable statistics demands rigorous capabilities spanning survey design, sampling methodology, index compilation (e.g. CPI, WPI), and modern computational tools (Python, R, SQL). However, capacity building in official statistics has traditionally relied on static training schedules. Professionals lack personalized diagnostic tools to benchmark their current abilities against role mandates, resulting in persistent capability gaps and inefficient training allocations.", body_style))

    # 2. Problem Statement
    story.append(Paragraph("2. Problem Statement", h2_style))
    story.append(Paragraph("SAMARTH AI resolves four core structural bottlenecks in civil service capacity building: (a) <i>Lack of Standardized Competency Mapping:</i> Absence of explicit rubrics defining required proficiencies across distinct statistical cadre roles; (b) <i>Invisible Skill Gaps:</i> Inability to quantitatively evaluate an individual's delta across required vs. attained skills; (c) <i>Fragmented Learning Discovery:</i> Disconnect between identified skill needs and available certified modules on government platforms such as iGOT Karmayogi; and (d) <i>Unverified Competency Growth:</i> Lack of closed-loop diagnostic evaluation confirming that training translates into certified proficiency.", body_style))

    # 3. System Architecture & Methodology
    story.append(Paragraph("3. System Architecture & Methodology", h2_style))
    story.append(Paragraph("The platform implements a modular four-tier architecture designed for scalability, security, and real-time responsiveness:", body_style))
    story.append(Paragraph("&bull; <b>Competency Framework:</b> Defines granular competencies across Statistical (S01-S14), Technical (T01-T14), and Digital Governance (D01-D06) domains, evaluated on a 0 (None) to 5 (Expert) proficiency rubric.", body_style))
    story.append(Paragraph("&bull; <b>AI-Based Skill Gap Analysis Engine:</b> Evaluates role mandates against learner profiles. Computes gap deltas (&Delta; = max(0, Level_required - Level_current)) and produces a weighted Role Readiness Score (0-100%) alongside Critical (&Delta; &ge; 2) and Moderate (&Delta; = 1) severity alerts.", body_style))
    story.append(Paragraph("&bull; <b>iGOT Recommender System:</b> Ranks catalogued courses from iGOT Karmayogi and NSSTA to close critical gaps, generating explainable AI rationales for each recommendation.", body_style))
    story.append(Paragraph("&bull; <b>Automated Assessment Engine:</b> Evaluates learner responses to diagnostic questions, updates competency levels dynamically upon passing (threshold &ge; 70%), and logs immutable audit evidence.", body_style))

    # 4. Implementation Status
    story.append(Paragraph("4. Current Implementation Status", h2_style))
    story.append(Paragraph("SAMARTH AI has advanced through two development milestones as summarized below:", body_style))

    table_data = [
        ["Layer / Module", "Features Implemented", "Status"],
        ["Auth & Security", "JWT token rotation, CSRF defense, RBAC, hash-chain audit log", "Complete"],
        ["Competency Engine", "30+ official statistics competencies, 6-level taxonomy, role profiles", "Complete"],
        ["Skill Gap Engine", "Quantitative gap delta, critical severity tagging, readiness score", "Complete"],
        ["Recommender", "iGOT Karmayogi course catalog integration, AI reason generation", "Complete"],
        ["Assessment Module", "Diagnostic evaluations, instant scoring, competency level auto-upgrade", "Complete"]
    ]
    t_status = Table(table_data, colWidths=[120, 310, 100])
    t_status.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f0ede6')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#111111')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#b0b0b0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_status)
    story.append(Spacer(1, 8))

    # 5. Conclusion & Future Work
    story.append(Paragraph("5. Conclusion & Future Work", h2_style))
    story.append(Paragraph("SAMARTH AI demonstrates an operational prototype for intelligent capacity building in official statistics. By bridging gap detection, course recommendations from iGOT Karmayogi, and dynamic assessment loop closure, the system empowers public servants with personalized learning pathways. Future milestones will implement blockchain-anchored credential verification and generative LLM question authoring.", body_style))

    # References
    story.append(Paragraph("6. References", h2_style))
    refs = [
        "[1] D. M. Popa, S.-V. Oprea and A. Bâra, 'Generative-AI and the transformation of workforce: A job postings-driven analysis,' arXiv:2605.00843, 2026.",
        "[2] M. C. Urdaneta-Ponte, A. Mendez-Zorrilla and I. Oleagordia-Ruiz, 'Recommendation systems for education: Systematic review,' Electronics, vol. 10, no. 14, 2021.",
        "[3] P. Lewis et al., 'Retrieval-augmented generation for knowledge-intensive NLP tasks,' in Proc. NeurIPS, 2020.",
        "[4] S. A. Crosby and D. S. Wallach, 'Efficient data structures for tamper-evident logging,' in Proc. 18th USENIX Security Symposium, 2009."
    ]
    for r in refs:
        story.append(Paragraph(r, ParagraphStyle('RefStyle', parent=styles['Normal'], fontName='Times-Roman', fontSize=8, leading=11)))

    doc.build(story)
    print("PDF GENERATED SUCCESSFULLY:", pdf_filename)

if __name__ == '__main__':
    generate_pdf()
