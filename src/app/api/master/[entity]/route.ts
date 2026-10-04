export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;

  return Response.json({
    message: `Master ${entity} list placeholder`,
    entity,
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const { entity } = await params;

  return Response.json({
    message: `Create ${entity} placeholder`,
    entity,
  });
}
