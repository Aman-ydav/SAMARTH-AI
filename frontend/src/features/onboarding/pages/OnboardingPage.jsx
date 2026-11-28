import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AssessmentStep } from "@/features/onboarding/components/AssessmentStep";
import { ReviewStep } from "@/features/onboarding/components/ReviewStep";
import { RoleStep } from "@/features/onboarding/components/RoleStep";
import {
    fetchFramework,
    fetchRoles,
    onboardingReset,
    selectOnboarding,
    submitOnboarding,
} from "@/features/onboarding";
import {
    profileSaved,
    ratingSet,
    stepChanged,
} from "@/features/onboarding/slice/onboardingSlice";
import { STATUS } from "@/lib/asyncState";
import { PATHS } from "@/lib/paths";

const STEP_COUNT = 3;

/** Three-step onboarding wizard. Answers stay in Redux while it is open; success sends the learner to the dashboard. */
export default function OnboardingPage() {
    const { t } = useTranslation("common");
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { step, profile, ratings, framework, roles, submit } =
        useAppSelector(selectOnboarding);
    const headingRef = useRef(null);

    useEffect(() => {
        dispatch(fetchFramework());
        dispatch(fetchRoles());
    }, [dispatch]);

    useEffect(() => {
        headingRef.current?.focus();
    }, [step]);

    useEffect(() => {
        if (submit.status === STATUS.SUCCEEDED) {
            dispatch(onboardingReset());
            navigate(PATHS.dashboard, { replace: true });
        }
    }, [submit.status, dispatch, navigate]);

    const go = (next) => dispatch(stepChanged(next));

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-2xl flex-col gap-6 focus:outline-none"
        >
            <h1 className="type-h1 text-foreground">
                {t("onboarding.title")}
            </h1>
            <Progress
                value={(step / STEP_COUNT) * 100}
                aria-label={t("onboarding.progress", {
                    step,
                    total: STEP_COUNT,
                })}
            />
            <Card>
                <CardHeader>
                    <CardTitle
                        ref={headingRef}
                        tabIndex={-1}
                        className="focus-visible:outline-2 focus-visible:outline-ring"
                    >
                        {t(`onboarding.steps.${step}`)}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {step === 1 && (
                        <RoleStep
                            profile={profile}
                            roles={roles}
                            onRetryRoles={() => dispatch(fetchRoles())}
                            onSubmit={(values) => {
                                dispatch(profileSaved(values));
                                go(2);
                            }}
                        />
                    )}
                    {step === 2 && (
                        <AssessmentStep
                            framework={framework}
                            ratings={ratings}
                            onRate={(competencyId, level) =>
                                dispatch(ratingSet({ competencyId, level }))
                            }
                            onRetry={() => dispatch(fetchFramework())}
                            onBack={() => go(1)}
                            onNext={() => go(3)}
                        />
                    )}
                    {step === 3 && (
                        <ReviewStep
                            profile={profile}
                            roles={roles}
                            framework={framework}
                            ratings={ratings}
                            submit={submit}
                            onBack={() => go(2)}
                            onFinish={() => dispatch(submitOnboarding())}
                        />
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
