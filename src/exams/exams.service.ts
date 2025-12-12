import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  async getExams() {
    return this.prisma.examPost.findMany({
      include: {
        post: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getExamById(id: string) {
    return this.prisma.examPost.findUnique({
      where: { id },
      include: {
        post: true,
      },
    });
  }

  async submitExam(userId: string, examPostId: string, answers: any) {
    const exam = await this.prisma.examPost.findUnique({
      where: { id: examPostId },
    });

    if (!exam) {
      throw new Error('Exam not found');
    }

    // Calculate score
    let score = 0;
    const questions = exam.questions as any[];
    for (let i = 0; i < questions.length; i++) {
      if (questions[i].correctAnswer === answers[i]) {
        score++;
      }
    }

    const isPassed = exam.passingMarks ? score >= exam.passingMarks : true;

    return this.prisma.examAttempt.create({
      data: {
        userId,
        examPostId,
        answers,
        score,
        isPassed,
      },
    });
  }
}

