import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userDocuments = await prisma.document.findMany({
      where: {
        userId: session?.user?.id,
      },
    });

    if (!userDocuments) {
      return NextResponse.json(
        {
          message: "Cannot retrieve user documents ",
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        message: "User documents retrieved successfully",
        data: userDocuments,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Internal Sever error ${error}` },
        { status: 500 },
      );
    }
  }
}
