function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <h2>{statusCode ? `An error ${statusCode} occurred` : 'An error occurred'}</h2>
      <a href="/" style={{ marginTop: '20px', color: '#0070f3', textDecoration: 'none' }}>
        Go home
      </a>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: any) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
