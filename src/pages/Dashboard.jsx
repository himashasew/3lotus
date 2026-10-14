import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, orderBy, limit } from '../services/data';
import { db } from '../services/data';

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ orders: 0, clients: 0, stock: 0, revenue: 0 });
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [ordersSnap, clientsSnap, productsSnap] = await Promise.all([
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'products')),
      ]);

      let totalRevenue = 0;
      const orders = [];
      ordersSnap.forEach((doc) => {
        const data = doc.data();
        totalRevenue += data.total || 0;
        orders.push({ id: doc.id, ...data });
      });

      setStats({
        orders: ordersSnap.size,
        clients: clientsSnap.size,
        stock: productsSnap.size,
        revenue: totalRevenue,
      });

      setRecentOrders(orders.slice(-5).reverse());
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  };

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>{t('dashboard')}</h1>

      <div className="dashboard-grid">
        <div className="stat-card orders">
          <div className="stat-info">
            <h3>{t('totalOrders')}</h3>
            <div className="stat-value">{stats.orders}</div>
          </div>
          <div className="stat-icon">📋</div>
        </div>

        <div className="stat-card clients">
          <div className="stat-info">
            <h3>{t('totalClients')}</h3>
            <div className="stat-value">{stats.clients}</div>
          </div>
          <div className="stat-icon">🏢</div>
        </div>

        <div className="stat-card stock">
          <div className="stat-info">
            <h3>{t('totalProducts')}</h3>
            <div className="stat-value">{stats.stock}</div>
          </div>
          <div className="stat-icon">📦</div>
        </div>

        <div className="stat-card revenue">
          <div className="stat-info">
            <h3>{t('totalRevenue')}</h3>
            <div className="stat-value">Rs. {stats.revenue.toLocaleString()}</div>
          </div>
          <div className="stat-icon">💰</div>
        </div>
      </div>

      <div className="data-section">
        <div className="data-section-header">
          <h2>{t('recentOrders')}</h2>
        </div>
        {recentOrders.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('client')}</th>
                <th>{t('date')}</th>
                <th>{t('total')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.clientName || '-'}</td>
                  <td>{order.date || '-'}</td>
                  <td>Rs. {(order.total || 0).toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${(order.status || 'pending').toLowerCase()}`}>
                      {order.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>{t('noOrders')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
