const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const { createApp } = require("../index");

const equipoInicial = {
  id: 1,
  numeroSerie: "SN-INICIAL-001",
  marca: "Dell",
  modelo: "OptiPlex 7090",
  fechaAdquisicion: "2023-03-15",
  estado: "DISPONIBLE",
  numeroInventario: 1001,
  ubicacion: "Oficina 101",
};

const equipoNuevo = {
  numeroSerie: "SN-NUEVO-002",
  marca: "HP",
  modelo: "ProDesk 600 G6",
  fechaAdquisicion: "2024-02-29",
  estado: "DISPONIBLE",
  numeroInventario: 1002,
  ubicacion: "Oficina 102",
};

let tempDir;
let dbFile;
let server;
let baseUrl;
let accessToken;
let equipoCreadoId;

async function request(route, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined || options.rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || "GET",
    headers,
    body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "it-inventory-api-test-"));
  dbFile = path.join(tempDir, "db.json");
  fs.writeFileSync(dbFile, JSON.stringify({ users: [], equipos: [equipoInicial] }, null, 2));

  const app = createApp({ dbFile, logger: false });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

test("rechaza inventario y usuarios sin autenticación y oculta la base completa", async () => {
  const equipos = await request("/equipos");
  const usuarios = await request("/users");
  const baseCompleta = await request("/db");

  assert.equal(equipos.status, 401);
  assert.equal(usuarios.status, 401);
  assert.equal(baseCompleta.status, 404);
});

test("valida los datos del registro", async () => {
  const correoInvalido = await request("/register", {
    method: "POST",
    body: { email: "no-es-un-correo", password: "clave123" },
  });
  const passwordCorta = await request("/register", {
    method: "POST",
    body: { email: "valido@correo.com", password: "abc" },
  });

  assert.equal(correoInvalido.status, 400);
  assert.equal(passwordCorta.status, 400);
});

test("registra un usuario, guarda el hash y devuelve una sesión sin password", async () => {
  const response = await request("/register", {
    method: "POST",
    body: { email: "prueba@correo.com", password: "clave123" },
  });

  assert.equal(response.status, 201);
  assert.equal(typeof response.body.accessToken, "string");
  assert.equal(response.body.user.email, "prueba@correo.com");
  assert.equal("password" in response.body.user, false);
  accessToken = response.body.accessToken;

  const datos = JSON.parse(fs.readFileSync(dbFile, "utf8"));
  assert.notEqual(datos.users[0].password, "clave123");
  assert.match(datos.users[0].password, /^\$2[aby]\$/);
});

test("rechaza correos duplicados", async () => {
  const response = await request("/register", {
    method: "POST",
    body: { email: "prueba@correo.com", password: "otraClave123" },
  });

  assert.equal(response.status, 400);
});

test("permite login válido y rechaza credenciales incorrectas", async () => {
  const loginValido = await request("/login", {
    method: "POST",
    body: { email: "prueba@correo.com", password: "clave123" },
  });
  const loginInvalido = await request("/login", {
    method: "POST",
    body: { email: "prueba@correo.com", password: "incorrecta" },
  });

  assert.equal(loginValido.status, 200);
  assert.equal(typeof loginValido.body.accessToken, "string");
  assert.equal(loginInvalido.status, 400);
});

test("rechaza un cuerpo con JSON mal formado", async () => {
  const response = await request("/equipos", {
    method: "POST",
    token: accessToken,
    rawBody: '{"numeroSerie":',
  });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /JSON inválido/);
});

test("rechaza un equipo incompleto o con fecha imposible", async () => {
  const incompleto = await request("/equipos", {
    method: "POST",
    token: accessToken,
    body: { numeroSerie: "SN-INCOMPLETO" },
  });
  const fechaInvalida = await request("/equipos", {
    method: "POST",
    token: accessToken,
    body: { ...equipoNuevo, numeroSerie: "SN-FECHA", numeroInventario: 1099, fechaAdquisicion: "2023-02-29" },
  });

  assert.equal(incompleto.status, 400);
  assert.equal(fechaInvalida.status, 400);
});

test("crea y lista equipos con autenticación", async () => {
  const creado = await request("/equipos", {
    method: "POST",
    token: accessToken,
    body: equipoNuevo,
  });

  assert.equal(creado.status, 201);
  assert.equal(creado.body.numeroSerie, equipoNuevo.numeroSerie);
  assert.ok(creado.body.id !== undefined);
  equipoCreadoId = creado.body.id;

  const lista = await request("/equipos", { token: accessToken });
  assert.equal(lista.status, 200);
  assert.equal(lista.body.length, 2);
});

test("obtiene y actualiza un equipo", async () => {
  const obtenido = await request(`/equipos/${equipoCreadoId}`, { token: accessToken });
  const actualizado = await request(`/equipos/${equipoCreadoId}`, {
    method: "PATCH",
    token: accessToken,
    body: { estado: "EN_USO", ubicacion: "Laboratorio 3" },
  });

  assert.equal(obtenido.status, 200);
  assert.equal(obtenido.body.id, equipoCreadoId);
  assert.equal(actualizado.status, 200);
  assert.equal(actualizado.body.estado, "EN_USO");
  assert.equal(actualizado.body.ubicacion, "Laboratorio 3");
  assert.equal(actualizado.body.numeroSerie, equipoNuevo.numeroSerie);
});

test("rechaza números de serie o inventario duplicados", async () => {
  const response = await request("/equipos", {
    method: "POST",
    token: accessToken,
    body: { ...equipoNuevo, numeroInventario: 2002 },
  });

  assert.equal(response.status, 409);
});

test("elimina un equipo y confirma que ya no existe", async () => {
  const eliminado = await request(`/equipos/${equipoCreadoId}`, {
    method: "DELETE",
    token: accessToken,
  });
  const consulta = await request(`/equipos/${equipoCreadoId}`, { token: accessToken });

  assert.equal(eliminado.status, 200);
  assert.equal(consulta.status, 404);
});
