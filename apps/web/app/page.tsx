import { APP_NAME } from '@coding-arena/shared';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>{APP_NAME}</h1>
        <p className={styles.tagline}>
          Two players. One challenge. Ten minutes. First to pass all tests wins.
        </p>
        <p className={styles.note}>Foundation build — sign-in and play arrive with Iteration 1+.</p>
      </section>
    </main>
  );
}
