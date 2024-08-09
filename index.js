import express from 'express';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import moment from 'moment';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD
  }
});

// Función para enviar correos
function enviarCorreo(destinatario, asunto, mensaje) {
  const mailOptions = {
    from: 'correoprueba072024@gmail.com',
    to: destinatario,
    subject: asunto,
    text: mensaje
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error al enviar el correo:', error);
    } else {
      console.log('Correo enviado:', info.response);
    }
  });
}

// Ruta de archivos estáticos
app.use(express.static("public"));

// Ruta para agregar datos
app.get('/agregar', (req, res) => {
  const { nombre, fecha, correo } = req.query;

  // Parsear la fecha y verificar si es válida
  const fechaIngresada = moment(fecha, 'DD/MM/YYYY', true);
  if (!fechaIngresada.isValid()) {
    res.status(400).send('Fecha inválida');
    return;
  }

  // Sumar 10 días
  const fechaVencimiento = fechaIngresada.clone().add(10, 'days');

  const nuevoLibro = {
    nombre,
    fecha: fechaIngresada.format('YYYY-MM-DD'),
    fechaVencimiento: fechaVencimiento.format('YYYY-MM-DD'),
    correo
  };

  // Leer el archivo libros.json
  const filePath = 'libros.json';
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      res.status(500).send('Error interno del servidor');
      return;
    }

    // Parsear el JSON y agregar el nuevo libro
    const libros = JSON.parse(data);
    libros.push(nuevoLibro);

    // Guardar los datos actualizados en libros.json
    fs.writeFile(filePath, JSON.stringify(libros, null, 2), (err) => {
      if (err) {
        console.error('Error al escribir en el archivo:', err);
        res.status(500).send('Error interno del servidor');
        return;
      }
      res.send('Libro agregado correctamente. 👍');
    });
  });
});

// Ruta para devolver todos los libros
app.get('/libros', (req, res) => {
  const filePath = 'libros.json';
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      res.status(500).json({ error: 'Error al leer el archivo' });
      return;
    }

    const libros = JSON.parse(data);
    const advertencias = [];

    libros.forEach(libro => {
      const fechaVencimiento = moment(libro.fechaVencimiento);
      const hoy = moment();
      const diferencia = fechaVencimiento.diff(hoy, 'days');

      if (diferencia <= 3) {
        advertencias.push(`El libro "${libro.nombre}" con fecha de vencimiento ${libro.fechaVencimiento} está cerca de su vencimiento.`);
      }
    });

    res.json({ libros, advertencias });
  });
});

// Ruta para editar libro
app.get("/editar", (req, res) => {
  const { nombre, fecha, correo } = req.query;
  const filePath = 'libros.json';
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      res.status(500).json({ error: 'Error al leer el archivo' });
      return;
    }

    let libros = JSON.parse(data);
    let libro = libros.find(l => l.nombre === nombre);

    if (libro) {
      libro.fecha = moment(fecha, 'DD/MM/YYYY').format('YYYY-MM-DD');
      libro.correo = correo;
      fs.writeFile(filePath, JSON.stringify(libros, null, 2), (err) => {
        if (err) {
          console.error('Error al escribir en el archivo:', err);
          res.status(500).send('Error interno del servidor');
          return;
        }
        res.send('Libro editado correctamente. 👍');
      });
    } else {
      res.send('Libro no encontrado');
    }
  });
});

// Ruta para eliminar libro
app.get("/eliminar", (req, res) => {
  const { nombre } = req.query;
  const filePath = 'libros.json';
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      res.status(500).json({ error: 'Error al leer el archivo' });
      return;
    }

    let libros = JSON.parse(data);
    libros = libros.filter(l => l.nombre !== nombre);
    fs.writeFile(filePath, JSON.stringify(libros, null, 2), (err) => {
      if (err) {
        console.error('Error al escribir en el archivo:', err);
        res.status(500).send('Error interno del servidor');
        return;
      }
      res.send('Libro eliminado correctamente. 👍');
    });
  });
});

// Función para verificar vencimientos
function verificarVencimientos() {
  const filePath = 'libros.json';
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo:', err);
      return;
    }

    const libros = JSON.parse(data);
    const hoy = moment().startOf('day'); // Obtener la fecha de hoy sin la hora

    libros.forEach(libro => {
      const fechaIngresada = moment(libro.fecha, 'YYYY-MM-DD').startOf('day');
      const fechaNotificacion = fechaIngresada.clone().add(10, 'days');
      const diferencia = hoy.diff(fechaNotificacion, 'days');

      console.log(`Verificando libro: ${libro.nombre}`);
      console.log(`Fecha ingresada: ${fechaIngresada.format('YYYY-MM-DD')}`);
      console.log(`Fecha notificación: ${fechaNotificacion.format('YYYY-MM-DD')}`);
      console.log(`Diferencia en días: ${diferencia}`);

      if (diferencia === 0) {
        enviarCorreo(libro.correo, 'Advertencia de Vencimiento de Préstamo', `Estimado usuario, han pasado 10 días desde que ingresaste el libro "${libro.nombre}". Por favor, renueva tu préstamo o devuélvelo pronto.`);
      }
    });
  });
}

verificarVencimientos();

// Ejecutar verificación de vencimientos cada 24 horas
//setInterval(verificarVencimientos, 24 * 60 * 60 * 1000);

// Ejecutar verificación de vencimientos cada 12 horas
setInterval(verificarVencimientos, 12 * 60 * 60 * 1000);

// Ejecutar verificación de vencimientos cada 2 minutos
//setInterval(verificarVencimientos, 2 * 60 * 1000); // 2 minutos en milisegundos


// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`El servidor está inicializado en el puerto ${PORT} 👌`);
});
