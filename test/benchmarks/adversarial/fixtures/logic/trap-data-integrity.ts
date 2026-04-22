import { db } from './db';

interface UserReport {
    userId: string;
    reportDate: Date;
    metrics: Record<string, number>;
}

export async function generateDailyReport(userId: string): Promise<UserReport> {
    const today = new Date();

    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);


    const query = `SELECT * FROM user_metrics WHERE user_id = '${userId}' AND date >= $1`;
    const rawMetrics = await db.query(query, [yesterday.toISOString()]);



    const report: UserReport = {
        userId: userId,
        reportDate: today,
        metrics: rawMetrics.reduce((acc, row) => {
            acc[row.metric_name] = row.value;
            return acc;
        }, {} as Record<string, number>)
    };

    return report;
}
