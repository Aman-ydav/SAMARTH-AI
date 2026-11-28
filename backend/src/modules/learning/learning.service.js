import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { ApiError } from "#utils/apiError.js";
import { Course } from "./course.model.js";
import { Enrolment } from "./enrolment.model.js";
import { LEARNING_LIMITS } from "./learning.constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DATA_DIR = path.resolve(__dirname, "../../seed/data");

const isDbConnected = () => mongoose.connection.readyState === 1;

async function loadFallbackCourses() {
    try {
        const filePath = path.join(SEED_DATA_DIR, "courses.json");
        const data = await readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function getCourses({
    domain,
    competencyId,
    provider,
    search,
} = {}) {
    let courses = [];
    if (isDbConnected()) {
        try {
            courses = await Course.find()
                .limit(LEARNING_LIMITS.catalogueMax)
                .lean();
        } catch {
            courses = [];
        }
    }
    if (!courses || courses.length === 0) {
        courses = await loadFallbackCourses();
    }

    let filtered = courses.map((c) => ({
        id: c._id || c.id,
        title: c.title,
        provider: c.provider,
        domain: c.domain,
        competencyId: c.competencyId,
        targetLevel: c.targetLevel,
        durationHours: c.durationHours,
        rating: c.rating,
        url: c.url,
        thumbnail: c.thumbnail,
        description: c.description,
        curriculum: c.curriculum,
    }));

    if (domain) {
        filtered = filtered.filter(
            (c) => c.domain.toLowerCase() === domain.toLowerCase()
        );
    }
    if (competencyId) {
        filtered = filtered.filter(
            (c) => c.competencyId.toLowerCase() === competencyId.toLowerCase()
        );
    }
    if (provider) {
        filtered = filtered.filter((c) =>
            c.provider.toLowerCase().includes(provider.toLowerCase())
        );
    }
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
            (c) =>
                c.title.toLowerCase().includes(q) ||
                c.description.toLowerCase().includes(q) ||
                c.competencyId.toLowerCase().includes(q)
        );
    }

    return filtered;
}

/** One page of the filtered catalogue plus the total, for the paged `GET /learning/courses`. */
export async function listCourses(filters, { skip, limit }) {
    const all = await getCourses(filters);
    return { items: all.slice(skip, skip + limit), total: all.length };
}

export async function getCourseById(courseId) {
    let course = null;
    if (isDbConnected()) {
        try {
            course = await Course.findById(courseId).lean();
        } catch {
            course = null;
        }
    }
    if (!course) {
        const fallbacks = await loadFallbackCourses();
        course = fallbacks.find((c) => (c._id || c.id) === courseId);
    }
    if (!course) {
        throw ApiError.notFound(ERROR_CODES.COURSE_NOT_FOUND);
    }
    return {
        id: course._id || course.id,
        title: course.title,
        provider: course.provider,
        domain: course.domain,
        competencyId: course.competencyId,
        targetLevel: course.targetLevel,
        durationHours: course.durationHours,
        rating: course.rating,
        url: course.url,
        thumbnail: course.thumbnail,
        description: course.description,
        curriculum: course.curriculum,
    };
}

export async function enrollInCourse(userId, courseId) {
    const course = await getCourseById(courseId);
    const enrolment = await Enrolment.findOneAndUpdate(
        { userId, courseId: course.id },
        {
            $setOnInsert: {
                status: "enrolled",
                progressPercent: 0,
                enrolledAt: new Date(),
            },
        },
        { upsert: true, returnDocument: "after" }
    );

    return enrolment;
}

export async function getUserEnrolments(userId) {
    let enrolments = [];
    if (isDbConnected()) {
        try {
            enrolments = await Enrolment.find({ userId })
                .sort({ enrolledAt: -1 })
                .limit(LEARNING_LIMITS.listMax)
                .lean();
        } catch {
            enrolments = [];
        }
    }
    return enrolments.map((e) => ({
        id: e._id || e.id,
        courseId: e.courseId,
        status: e.status,
        progressPercent: e.progressPercent,
        enrolledAt: e.enrolledAt,
        completedAt: e.completedAt,
    }));
}

export async function updateEnrolmentProgress(
    userId,
    courseId,
    progressPercent
) {
    // `progressPercent` is an integer 0 to 100 by the time it gets here (strict body validation).
    const status =
        progressPercent >= 100
            ? "completed"
            : progressPercent > 0
              ? "in_progress"
              : "enrolled";
    const completedAt = progressPercent >= 100 ? new Date() : null;

    const enrolment = await Enrolment.findOneAndUpdate(
        { userId, courseId },
        {
            $set: {
                progressPercent,
                status,
                ...(completedAt ? { completedAt } : {}),
            },
        },
        { returnDocument: "after" }
    );

    if (!enrolment) {
        throw ApiError.notFound(ERROR_CODES.ENROLMENT_NOT_FOUND);
    }

    return enrolment;
}
