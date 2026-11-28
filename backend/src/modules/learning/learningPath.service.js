import { calculateGapAnalysis } from "../competency/competencyGap.service.js";
import { DEFAULT_TARGET_ROLE, LEARNING_LIMITS } from "./learning.constants.js";
import { getCourses, getUserEnrolments } from "./learning.service.js";

export async function getRecommendationsForUser(
    userId,
    targetRoleId = DEFAULT_TARGET_ROLE
) {
    const gapAnalysis = await calculateGapAnalysis(userId, targetRoleId);
    const allCourses = await getCourses();
    const enrolments = await getUserEnrolments(userId);
    const enrolledIds = new Set(enrolments.map((e) => e.courseId));

    const gapMap = new Map();
    for (const g of gapAnalysis.gaps) {
        gapMap.set(g.competencyId, g);
    }

    const recommendations = [];

    for (const course of allCourses) {
        const gap = gapMap.get(course.competencyId);
        const isEnrolled = enrolledIds.has(course.id);

        let priorityScore = 10;
        let aiReason = `Strengthens foundational knowledge in ${course.domain}.`;

        if (gap) {
            if (gap.severity === "critical") {
                priorityScore = 95 + course.rating * 2;
                aiReason = `Directly closes your Critical Skill Gap in ${gap.name} (Current Level ${gap.currentLevel} → Target Level ${gap.requiredLevel} for ${gapAnalysis.targetRole.title}).`;
            } else if (gap.severity === "moderate") {
                priorityScore = 70 + course.rating * 2;
                aiReason = `Recommended to upgrade ${gap.name} from Level ${gap.currentLevel} to required Level ${gap.requiredLevel}.`;
            } else {
                priorityScore = 40 + course.rating * 2;
                aiReason = `Advanced mastery course for ${gap.name} to reinforce role readiness.`;
            }
        }

        recommendations.push({
            ...course,
            isEnrolled,
            priorityScore,
            aiReason,
            matchedGap: gap
                ? {
                      competencyId: gap.competencyId,
                      severity: gap.severity,
                      currentLevel: gap.currentLevel,
                      requiredLevel: gap.requiredLevel,
                  }
                : null,
        });
    }

    // Rank: highest priority score first, enrolled courses lower
    recommendations.sort((a, b) => {
        if (a.isEnrolled !== b.isEnrolled) return a.isEnrolled ? 1 : -1;
        return b.priorityScore - a.priorityScore;
    });

    return {
        targetRole: gapAnalysis.targetRole,
        readinessScore: gapAnalysis.readinessScore,
        // The best matches only: the list is ranked, and a response never grows with the catalogue (BE-25).
        recommendations: recommendations.slice(
            0,
            LEARNING_LIMITS.recommendationsMax
        ),
    };
}

export async function getLearningPath(
    userId,
    targetRoleId = DEFAULT_TARGET_ROLE
) {
    const recResult = await getRecommendationsForUser(userId, targetRoleId);
    const courses = recResult.recommendations;

    const stage1Courses = courses
        .filter(
            (c) => c.matchedGap?.severity === "critical" || c.targetLevel <= 2
        )
        .slice(0, 3);

    const stage2Courses = courses
        .filter(
            (c) =>
                c.matchedGap?.severity === "moderate" ||
                (c.targetLevel === 3 && !stage1Courses.includes(c))
        )
        .slice(0, 3);

    const stage3Courses = courses
        .filter(
            (c) =>
                c.targetLevel >= 4 ||
                (!stage1Courses.includes(c) && !stage2Courses.includes(c))
        )
        .slice(0, 3);

    const stages = [
        {
            stage: 1,
            name: "Phase 1: Foundational Skill Recovery",
            description:
                "Eliminate high-risk critical gaps in fundamental survey and statistical methodology.",
            courses: stage1Courses,
            estimatedHours: stage1Courses.reduce(
                (sum, c) => sum + c.durationHours,
                0
            ),
        },
        {
            stage: 2,
            name: "Phase 2: Core Official Statistics Domain Proficiency",
            description:
                "Master primary data collection, index compilation, and regulatory standards.",
            courses: stage2Courses,
            estimatedHours: stage2Courses.reduce(
                (sum, c) => sum + c.durationHours,
                0
            ),
        },
        {
            stage: 3,
            name: "Phase 3: Advanced Analytics, Inference & Modernization",
            description:
                "Adopt programmatic tooling, automation pipelines, and advanced predictive methods.",
            courses: stage3Courses,
            estimatedHours: stage3Courses.reduce(
                (sum, c) => sum + c.durationHours,
                0
            ),
        },
    ];

    const totalHours = stages.reduce((acc, s) => acc + s.estimatedHours, 0);

    return {
        targetRole: recResult.targetRole,
        readinessScore: recResult.readinessScore,
        totalHours,
        activeStage: 1,
        stages,
    };
}
