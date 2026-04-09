import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chats = await prisma.conversation.findMany({
      where: {
        userId: session?.user?.id,
      },
      include: {
        document: true,
        user: true,
        messages: true,
      },
      take: 5,
    });
    if (!chats) {
      return NextResponse.json(
        { error: "No recent chats found" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        message: "User chats retrieved successfully",
        data: chats,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Internal Sever Error" },
        { status: 500 },
      );
    }
  }
}
