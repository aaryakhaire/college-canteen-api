from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
from db import get_db_connection

app = Flask(__name__)
CORS(app)


# ✅ Health check
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "OK",
        "message": "College Canteen API is running"
    }), 200


# ✅ DB check
@app.route("/db-check", methods=["GET"])
def db_check():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1;")
        cur.close()
        conn.close()

        return jsonify({
            "status": "OK",
            "message": "PostgreSQL connection successful"
        }), 200

    except Exception as e:
        return jsonify({
            "status": "FAILED",
            "error": str(e)
        }), 500


# =========================================================
# ✅ MENU APIs
# =========================================================

@app.route("/menu", methods=["POST"])
def add_menu_item():
    data = request.get_json()

    name = data.get("name")
    price = data.get("price")
    category = data.get("category")

    if not name or price is None or not category:
        return jsonify({"error": "name, price, category are required"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO menu_items (name, price, category)
        VALUES (%s, %s, %s)
        RETURNING id, name, price, category, is_available, created_at;
        """,
        (name, price, category)
    )

    item = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "message": "Menu item added successfully",
        "item": {
            "id": item[0],
            "name": item[1],
            "price": float(item[2]),
            "category": item[3],
            "is_available": item[4],
            "created_at": str(item[5])
        }
    }), 201


@app.route("/menu", methods=["GET"])
def get_all_menu_items():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, name, price, category, is_available, created_at
        FROM menu_items
        ORDER BY id;
    """)
    rows = cur.fetchall()

    cur.close()
    conn.close()

    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "name": r[1],
            "price": float(r[2]),
            "category": r[3],
            "is_available": r[4],
            "created_at": str(r[5])
        })

    return jsonify({"menu_items": items}), 200


@app.route("/menu/<int:item_id>", methods=["GET"])
def get_menu_item_by_id(item_id):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, name, price, category, is_available, created_at
        FROM menu_items
        WHERE id = %s;
    """, (item_id,))

    row = cur.fetchone()

    cur.close()
    conn.close()

    if not row:
        return jsonify({"error": "Menu item not found"}), 404

    return jsonify({
        "item": {
            "id": row[0],
            "name": row[1],
            "price": float(row[2]),
            "category": row[3],
            "is_available": row[4],
            "created_at": str(row[5])
        }
    }), 200


@app.route("/menu/<int:item_id>", methods=["PUT"])
def update_menu_item(item_id):
    data = request.get_json()

    name = data.get("name")
    price = data.get("price")
    category = data.get("category")

    if not name or price is None or not category:
        return jsonify({"error": "name, price, category are required"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE menu_items
        SET name = %s, price = %s, category = %s
        WHERE id = %s
        RETURNING id, name, price, category, is_available, created_at;
    """, (name, price, category, item_id))

    updated = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    if not updated:
        return jsonify({"error": "Menu item not found"}), 404

    return jsonify({
        "message": "Menu item updated successfully",
        "item": {
            "id": updated[0],
            "name": updated[1],
            "price": float(updated[2]),
            "category": updated[3],
            "is_available": updated[4],
            "created_at": str(updated[5])
        }
    }), 200


@app.route("/menu/<int:item_id>", methods=["DELETE"])
def delete_menu_item(item_id):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM menu_items WHERE id = %s RETURNING id;", (item_id,))
    deleted = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    if not deleted:
        return jsonify({"error": "Menu item not found"}), 404

    return jsonify({"message": "Menu item deleted successfully"}), 200


@app.route("/menu/<int:item_id>/availability", methods=["PATCH"])
def update_availability(item_id):
    data = request.get_json()
    is_available = data.get("is_available")

    if is_available is None:
        return jsonify({"error": "is_available is required (true/false)"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE menu_items
        SET is_available = %s
        WHERE id = %s
        RETURNING id, name, price, category, is_available, created_at;
    """, (is_available, item_id))

    updated = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    if not updated:
        return jsonify({"error": "Menu item not found"}), 404

    return jsonify({
        "message": "Availability updated successfully",
        "item": {
            "id": updated[0],
            "name": updated[1],
            "price": float(updated[2]),
            "category": updated[3],
            "is_available": updated[4],
            "created_at": str(updated[5])
        }
    }), 200


# =========================================================
# ✅ ORDERS APIs
# =========================================================

@app.route("/orders", methods=["POST"])
def create_order():
    """
    Expected JSON:
    {
      "customer_name": "Aarya",
      "items": [
        {"menu_item_id": 1, "quantity": 2},
        {"menu_item_id": 3, "quantity": 1}
      ]
    }
    """
    data = request.get_json()

    customer_name = data.get("customer_name")
    items = data.get("items")

    if not customer_name:
        return jsonify({"error": "customer_name is required"}), 400

    if not items or not isinstance(items, list):
        return jsonify({"error": "items must be a list"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    # Create order first
    cur.execute("""
        INSERT INTO orders (customer_name, status, total_amount)
        VALUES (%s, 'PLACED', 0)
        RETURNING id;
    """, (customer_name,))
    order_id = cur.fetchone()[0]

    total_amount = 0.0

    for item in items:
        menu_item_id = item.get("menu_item_id")
        quantity = item.get("quantity")

        if menu_item_id is None or quantity is None:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": "Each item must have menu_item_id and quantity"}), 400

        if quantity <= 0:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": "Quantity must be greater than 0"}), 400

        # Get menu item price + availability
        cur.execute("""
            SELECT price, is_available, name
            FROM menu_items
            WHERE id = %s;
        """, (menu_item_id,))
        menu_row = cur.fetchone()

        if not menu_row:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": f"Menu item id {menu_item_id} not found"}), 404

        price_each = float(menu_row[0])
        is_available = menu_row[1]
        menu_name = menu_row[2]

        if not is_available:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": f"Item '{menu_name}' is not available"}), 400

        line_total = price_each * quantity
        total_amount += line_total

        cur.execute("""
            INSERT INTO order_items (order_id, menu_item_id, quantity, price_each, line_total)
            VALUES (%s, %s, %s, %s, %s);
        """, (order_id, menu_item_id, quantity, price_each, line_total))

    # Update order total
    cur.execute("""
        UPDATE orders
        SET total_amount = %s
        WHERE id = %s;
    """, (total_amount, order_id))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "message": "Order placed successfully",
        "order_id": order_id,
        "total_amount": total_amount
    }), 201


@app.route("/orders", methods=["GET"])
def list_orders():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, customer_name, status, total_amount, created_at
        FROM orders
        ORDER BY id DESC;
    """)
    rows = cur.fetchall()

    cur.close()
    conn.close()

    orders = []
    for r in rows:
        orders.append({
            "id": r[0],
            "customer_name": r[1],
            "status": r[2],
            "total_amount": float(r[3]),
            "created_at": str(r[4])
        })

    return jsonify({"orders": orders}), 200


@app.route("/orders/<int:order_id>", methods=["GET"])
def get_order_details(order_id):
    conn = get_db_connection()
    cur = conn.cursor()

    # Get order basic info
    cur.execute("""
        SELECT id, customer_name, status, total_amount, created_at
        FROM orders
        WHERE id = %s;
    """, (order_id,))
    order = cur.fetchone()

    if not order:
        cur.close()
        conn.close()
        return jsonify({"error": "Order not found"}), 404

    # Get order items
    cur.execute("""
        SELECT oi.id, oi.menu_item_id, mi.name, oi.quantity, oi.price_each, oi.line_total
        FROM order_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.order_id = %s
        ORDER BY oi.id;
    """, (order_id,))
    items_rows = cur.fetchall()

    cur.close()
    conn.close()

    items = []
    for r in items_rows:
        items.append({
            "id": r[0],
            "menu_item_id": r[1],
            "menu_item_name": r[2],
            "quantity": r[3],
            "price_each": float(r[4]),
            "line_total": float(r[5])
        })

    return jsonify({
        "order": {
            "id": order[0],
            "customer_name": order[1],
            "status": order[2],
            "total_amount": float(order[3]),
            "created_at": str(order[4]),
            "items": items
        }
    }), 200


@app.route("/orders/<int:order_id>/status", methods=["PATCH"])
def update_order_status(order_id):
    data = request.get_json()
    status = data.get("status")

    allowed = ["PLACED", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"]

    if not status:
        return jsonify({"error": "status is required"}), 400

    if status not in allowed:
        return jsonify({"error": f"status must be one of {allowed}"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE orders
        SET status = %s
        WHERE id = %s
        RETURNING id, status;
    """, (status, order_id))

    updated = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    if not updated:
        return jsonify({"error": "Order not found"}), 404

    return jsonify({
        "message": "Order status updated",
        "order_id": updated[0],
        "status": updated[1]
    }), 200


# =========================================================
# ✅ FRONTEND SERVING
# =========================================================

@app.route("/", methods=["GET"])
def serve_index():
    return send_from_directory("frontend", "index.html")

@app.route("/orders-page", methods=["GET"])
def serve_orders_page():
    return send_from_directory("frontend", "orders.html")

@app.route("/<path:path>", methods=["GET"])
def serve_static(path):
    if os.path.exists(os.path.join("frontend", path)):
        return send_from_directory("frontend", path)
    return jsonify({"error": "Not Found"}), 404


if __name__ == "__main__":
    app.run(debug=True, port=5002, host="0.0.0.0")
